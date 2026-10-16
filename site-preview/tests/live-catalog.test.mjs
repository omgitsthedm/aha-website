import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { feedXml } from "../scripts/feeds.mjs";
import { handleAdmin } from "../server/admin/api.mjs";
import { normalizeItems } from "../server/checkout/catalog.mjs";
import { STATIC_PRODUCTS } from "../server/catalog/current.mjs";
import { liveAllowList, liveOnly, loadLiveCatalog, resetLiveCatalogMemo, validateLiveProduct } from "../server/catalog/live.mjs";
import { createLivePublisher, productImageKeys } from "../server/catalog/publish.mjs";
import { renderLivePage } from "../server/catalog/render.mjs";
import { AHA_FULFILLMENT_CATALOG } from "../server/fulfillment/catalog.mjs";
import { validatePaidSquareOrder } from "../server/fulfillment/service.mjs";
import { handleFeeds } from "../netlify/functions/catalog-feeds.mjs";
import { handleCatalogImage } from "../netlify/functions/catalog-image.mjs";
import { handleLiveCatalog } from "../netlify/functions/catalog-live.mjs";
import { handleProductPage } from "../netlify/functions/catalog-product.mjs";

const dist = new URL("../dist/", import.meta.url);
const built = (slug) => readFile(new URL(`shop/${slug}/index.html`, dist), "utf8");
const pet = STATIC_PRODUCTS.find((product) => product.slug === "pet-it-be-ss3000-maroon");
const titleFor = (product) => AHA_FULFILLMENT_CATALOG[product.variants[0].id].title ?? product.title;
const fulfillmentFor = (product) => ({ product: AHA_FULFILLMENT_CATALOG[product.variants[0].id].product, title: titleFor(product) });
const ids = (seed) => Array.from({ length: 8 }, (_, index) => `${seed}${String(index).padStart(2, "0")}`.padEnd(24, "Q"));

/** A new product shaped exactly like the engine writes it, but not in the build. */
function liveProduct(slug = "night-shift-ss3000-maroon") {
  const variantIds = ids("LIVEVAR");
  const move = (value) => value.replaceAll("/pet-it-be/pet-it-be-ss3000-maroon/", `/night-shift/${slug}/`);
  return {
    ...structuredClone(pet), slug, title: "Night Shift Crewneck", collection: "Night Shift", squareItemId: "LIVEITEMNIGHTSHIFT000001",
    gallery: pet.gallery.map((shot) => ({ ...shot, src: move(shot.src), srcset: move(shot.srcset), feedImage: move(shot.feedImage) })),
    variants: pet.variants.map((variant, index) => ({ ...variant, id: variantIds[index], sku: variant.sku.replace("6211854", "6299999") })),
    fulfillment: { product: "night_shift_ss3000_maroon", title: "Night Shift Crewneck — Maroon" },
  };
}

function memoryStore() {
  const data = new Map();
  const meta = new Map();
  return {
    data,
    async get(key, options = {}) { if (!data.has(key)) return null; const value = data.get(key); return options.type === "json" ? JSON.parse(value) : value; },
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async set(key, value, options = {}) { data.set(key, value); meta.set(key, options.metadata ?? {}); },
    async getMetadata(key) { return data.has(key) ? { etag: "1", metadata: meta.get(key) } : null; },
  };
}
const WEBP = () => { const bytes = new Uint8Array(32); bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return bytes.buffer; };

test("a live render of every built product is byte-identical to Astro's build", { skip: !existsSync(new URL("shop/", dist)) && "needs npm run build" }, async () => {
  for (const [index, product] of STATIC_PRODUCTS.entries()) {
    const shell = await built(STATIC_PRODUCTS[(index + 1) % STATIC_PRODUCTS.length].slug);
    assert.equal(renderLivePage(shell, product, STATIC_PRODUCTS), await built(product.slug), product.slug);
  }
});

test("every built product passes live validation, so the engine can publish any of them", () => {
  for (const product of STATIC_PRODUCTS) assert.doesNotThrow(() => validateLiveProduct({ ...product, fulfillment: fulfillmentFor(product) }), product.slug);
});

test("live validation refuses products that could break a page, the feeds or fulfillment", () => {
  const bad = [
    [(p) => { p.gallery[0].src = "/images/other/elsewhere/front.webp"; }, /gallery\[0\]\.src/],
    [(p) => { p.gallery[1].srcset = "https://evil.example/x.webp 400w"; }, /srcset/],
    [(p) => { p.gallery = p.gallery.slice(0, 3); }, /four garment images/],
    [(p) => { p.gallery[3].role = "front"; }, /one each of/],
    [(p) => { p.variants[1].sku = "APQ-1234S6A1"; }, /one Apliiq design/],
    [(p) => { p.variants[0].sku = "SKU-1"; }, /decorated Apliiq SKU/],
    [(p) => { p.price = 55.5; }, /whole dollars/],
    [(p) => { p.slug = "Bad Slug"; }, /slug/],
    [(p) => { delete p.fulfillment; }, /fulfillment\.product/],
    [(p) => { p.variants[1].size = p.variants[0].size; }, /repeated/],
  ];
  for (const [mutate, message] of bad) {
    const product = liveProduct();
    mutate(product);
    assert.throws(() => validateLiveProduct(product), message);
  }
});

test("built products and variations always win over the live snapshot", () => {
  const fresh = liveProduct();
  const shadow = { ...liveProduct("pet-it-be-ss3000-maroon"), slug: "pet-it-be-ss3000-maroon" };
  const hijack = { ...liveProduct("hijack-ss3000-maroon"), variants: [{ ...pet.variants[0] }] };
  const snapshot = { products: { [fresh.slug]: fresh, [shadow.slug]: shadow, [hijack.slug]: hijack } };
  assert.deepEqual(liveOnly(snapshot, STATIC_PRODUCTS).map((product) => product.slug), [fresh.slug]);
  const allow = liveAllowList([fresh], AHA_FULFILLMENT_CATALOG);
  assert.deepEqual(allow[fresh.variants[2].id], { sku: fresh.variants[2].sku, size: "M", priceCents: 5500, product: "night_shift_ss3000_maroon", title: "Night Shift Crewneck — Maroon" });
  assert.equal(Object.keys(liveAllowList([{ ...fresh, variants: [pet.variants[0]] }], AHA_FULFILLMENT_CATALOG)).length, 0);
});

test("a snapshot read failure fails closed: live products vanish, built ones are untouched", async () => {
  resetLiveCatalogMemo();
  const broken = { get: async () => { throw new Error("blobs down"); } };
  const live = await loadLiveCatalog({ staticProducts: STATIC_PRODUCTS, staticCatalog: AHA_FULFILLMENT_CATALOG, store: broken });
  assert.deepEqual(live, { products: [], allowList: {} });
  resetLiveCatalogMemo();
});

test("checkout prices and fulfillment SKUs for a live product come only from the merged allow list", () => {
  const product = liveProduct();
  const merged = { ...liveAllowList([product], AHA_FULFILLMENT_CATALOG), ...AHA_FULFILLMENT_CATALOG };
  const medium = product.variants[2];
  assert.throws(() => normalizeItems([{ variationId: medium.id, quantity: 1 }]), /invalid_cart/);
  assert.deepEqual(normalizeItems([{ variationId: medium.id, quantity: 2 }], merged)[0], { variationId: medium.id, quantity: 2, unitAmount: 5500, totalAmount: 11000, size: "M", product: "night_shift_ss3000_maroon" });
  const order = {
    id: "order-live-1", location_id: "loc", state: "OPEN", reference_id: "AHA-1", total_money: { amount: 5500, currency: "USD" },
    line_items: [{ uid: "l1", catalog_object_id: medium.id, quantity: "1", base_price_money: { amount: 5500, currency: "USD" } }],
    fulfillments: [{ uid: "f1", type: "SHIPMENT", state: "PROPOSED", shipment_details: { recipient: { display_name: "Ada Lovelace", address: { address_line_1: "1 Main St", locality: "New York", administrative_district_level_1: "NY", postal_code: "10001", country: "US" } } } }],
  };
  const payment = { id: "p1", order_id: order.id, location_id: "loc", status: "COMPLETED", created_at: "2026-10-17T00:00:00Z", amount_money: { amount: 5500, currency: "USD" } };
  assert.throws(() => validatePaidSquareOrder({ payment, order, locationId: "loc", startAt: "2026-10-15T00:00:00Z" }), /unknown_variation/);
  const validated = validatePaidSquareOrder({ payment, order, locationId: "loc", startAt: "2026-10-15T00:00:00Z", catalog: merged });
  assert.equal(validated.apliiqPayload.line_items[0].sku, medium.sku);
  assert.equal(validated.apliiqPayload.line_items[0].title, "Night Shift Crewneck — Maroon — M");
});

test("publishing refuses a product until every image it shows is stored, then purges its tags", async () => {
  const catalogStore = memoryStore();
  const images = memoryStore();
  const purged = [];
  const publisher = createLivePublisher({ catalogStore: () => catalogStore, imageStore: () => images, purge: async (tags) => { purged.push(tags); }, now: () => new Date("2026-10-17T12:00:00Z"), retryDelayMs: 1 });
  const product = liveProduct();
  await assert.rejects(publisher.putProduct(product.slug, product), /Upload these images first/);
  await assert.rejects(publisher.putImage(`night-shift/${product.slug}/garment-front-400.webp`, new TextEncoder().encode("<svg onload=alert(1)>").buffer), /isn't a webp image/);
  await assert.rejects(publisher.putImage("../etc/passwd", WEBP()), /Image path/);
  for (const key of productImageKeys(product)) {
    const bytes = key.endsWith(".jpg") ? new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer : WEBP();
    await publisher.putImage(key, bytes);
  }
  assert.equal(images.data.size, productImageKeys(product).length);
  assert.equal(purged.length, 0, "image uploads never purge (Netlify allows two purges per tag per five seconds)");
  assert.deepEqual(await publisher.putProduct(product.slug, product), { slug: product.slug, publishedAt: "2026-10-17T12:00:00.000Z", updatedAt: "2026-10-17T12:00:00.000Z", url: `/shop/${product.slug}/`, purged: true });
  assert.deepEqual(purged, [["catalog", `product:${product.slug}`]]);
  assert.equal((await publisher.list())[0].slug, product.slug);
  await assert.rejects(publisher.putProduct("other-slug", product), /slug must match/);
  assert.deepEqual(await publisher.removeProduct(product.slug), { slug: product.slug, removed: true, purged: true });
  assert.deepEqual(await publisher.list(), []);
});

test("a rate-limited purge is retried once and never fails a saved publish", async () => {
  const catalogStore = memoryStore();
  const images = memoryStore();
  let attempts = 0;
  const flaky = createLivePublisher({ catalogStore: () => catalogStore, imageStore: () => images, purge: async () => { attempts += 1; if (attempts === 1) throw new Error("429"); }, retryDelayMs: 1 });
  const product = liveProduct();
  for (const key of productImageKeys(product)) await flaky.putImage(key, key.endsWith(".jpg") ? new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer : WEBP());
  assert.equal((await flaky.putProduct(product.slug, product)).purged, true);
  assert.equal(attempts, 2);
  const down = createLivePublisher({ catalogStore: () => catalogStore, imageStore: () => images, purge: async () => { throw new Error("429"); }, retryDelayMs: 1 });
  const result = await down.putProduct(product.slug, product);
  assert.equal(result.purged, false);
  assert.equal((await down.list()).length, 1, "the product is saved even when the CDN purge fails");
});

test("live product page: rendered from a built shell with its security headers, cached and tagged", { skip: !existsSync(new URL("shop/", dist)) && "needs npm run build" }, async () => {
  const product = liveProduct();
  const shellHtml = await built(STATIC_PRODUCTS[0].slug);
  const fetchImpl = async (url) => (String(url).endsWith("/404.html")
    ? new Response("<h1>Not found</h1>", { status: 200 })
    : new Response(shellHtml, { headers: { "content-security-policy": "default-src 'self'", "x-frame-options": "DENY", "set-cookie": "no=1" } }));
  const catalog = async () => ({ products: [...STATIC_PRODUCTS, product], liveProducts: [product], allowList: {} });
  const page = await handleProductPage(new Request(`https://afterhoursagenda.com/shop/${product.slug}/`), { catalog, fetchImpl });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<h1>Night Shift Crewneck<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/[^"/]+\/shop\/night-shift-ss3000-maroon\/">/);
  assert.match(html, /<title>Night Shift Crewneck — Maroon \| After Hours Agenda<\/title>/);
  assert.match(html, new RegExp(`data-cart-catalog data-id="${product.variants[0].id}"`));
  assert.equal(page.headers.get("content-security-policy"), "default-src 'self'");
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal(page.headers.get("set-cookie"), null);
  assert.equal(page.headers.get("netlify-cache-tag"), `catalog,product:${product.slug}`);
  assert.match(page.headers.get("netlify-cdn-cache-control"), /durable/);
  assert.equal((await handleProductPage(new Request("https://afterhoursagenda.com/shop/nothing-here/"), { catalog, fetchImpl })).status, 404);
  const redirect = await handleProductPage(new Request(`https://afterhoursagenda.com/shop/${product.slug}?size=M`), { catalog, fetchImpl });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), `https://afterhoursagenda.com/shop/${product.slug}/?size=M`);
});

test("live images are served from the store with the right type, and only real paths", async () => {
  const images = memoryStore();
  await images.set("night-shift/night-shift-ss3000-maroon/garment-front-400.webp", WEBP(), { metadata: { contentType: "image/webp" } });
  const ok = await handleCatalogImage(new Request("https://afterhoursagenda.com/images/night-shift/night-shift-ss3000-maroon/garment-front-400.webp"), { store: () => images });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/webp");
  assert.equal(ok.headers.get("netlify-cache-tag"), "catalog-images,product:night-shift-ss3000-maroon");
  assert.equal((await handleCatalogImage(new Request("https://afterhoursagenda.com/images/night-shift/night-shift-ss3000-maroon/missing.webp"), { store: () => images })).status, 404);
  assert.equal((await handleCatalogImage(new Request("https://afterhoursagenda.com/images/a/b/c.svg"), { store: () => images })).status, 404);
});

test("feeds equal the build with nothing live, and advertise a live product the moment it can be bought", async () => {
  const production = { deploy: { context: "production" } };
  const empty = async () => ({ products: STATIC_PRODUCTS, liveProducts: [], allowList: AHA_FULFILLMENT_CATALOG });
  const baseline = await (await handleFeeds(new Request("https://afterhoursagenda.com/feeds/google.xml"), production, { catalog: empty })).text();
  assert.equal(baseline, feedXml(STATIC_PRODUCTS, "https://afterhoursagenda.com"));
  if (process.env.AHA_PRODUCTION_BUILD === "approved") assert.equal(baseline, await readFile(new URL("feeds/google.xml", dist), "utf8"));
  const product = liveProduct();
  const withLive = async () => ({ products: [...STATIC_PRODUCTS, product], liveProducts: [product], allowList: {} });
  const feed = await handleFeeds(new Request("https://afterhoursagenda.com/feeds/meta.xml"), production, { catalog: withLive });
  assert.equal(feed.headers.get("netlify-cache-tag"), "catalog,feeds");
  const xml = await feed.text();
  for (const variant of product.variants) assert.ok(xml.includes(`<g:id>${variant.id}</g:id>`));
  const sitemap = await (await handleFeeds(new Request("https://afterhoursagenda.com/sitemap-live.xml"), production, { catalog: withLive })).text();
  assert.match(sitemap, /<loc>https:\/\/afterhoursagenda\.com\/shop\/night-shift-ss3000-maroon\/<\/loc>/);
  const failing = async () => { throw new Error("down"); };
  assert.equal(await (await handleFeeds(new Request("https://afterhoursagenda.com/feeds/google.xml"), production, { catalog: failing })).text(), baseline);
});

test("live JSON gives the shop escaped cards and the bag exact sizes and prices", async () => {
  const product = liveProduct();
  product.title = `Night "Shift" <Crew>`;
  const response = await handleLiveCatalog(new Request("https://afterhoursagenda.com/api/catalog/live"), { catalog: async () => ({ liveProducts: [product] }) });
  const body = await response.json();
  assert.equal(body.products[0].slug, product.slug);
  assert.match(body.products[0].card, /Night &quot;Shift&quot; &lt;Crew&gt;/);
  // Same escaping as Astro: text is fully escaped; attribute values can't break out of their quotes.
  assert.doesNotMatch(body.products[0].card, /<Crew><\/a>/);
  assert.doesNotMatch(body.products[0].card, /"Shift"/);
  assert.equal(body.cartLines.length, product.variants.length);
  assert.deepEqual(body.cartLines[0], { id: product.variants[0].id, sku: product.variants[0].sku, size: "XS", slug: product.slug, title: `Night "Shift" <Crew> — Maroon`, color: "Maroon", priceCents: 5500, image: product.gallery[0].src, imageAlt: product.gallery[0].alt });
});

test("live publishing API needs the automation token and only writes on production", async (t) => {
  const database = new PGlite(); t.after(() => database.close());
  for (const name of ["20261016110000_product_drafts", "20261016120000_admin"]) await database.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const db = { sql: async (strings, ...parameters) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows };
  const token = "a".repeat(48);
  const env = { get: (key) => ({ ADMIN_ORIGIN: "https://afterhoursagenda.com", ADMIN_AUTOMATION_TOKEN: token })[key] };
  const calls = [];
  const live = { list: async () => [], putProduct: async (slug) => { calls.push(slug); return { slug }; }, removeProduct: async () => ({}), putImage: async () => ({}) };
  const put = (headers, context) => handleAdmin(new Request("https://afterhoursagenda.com/api/admin/automation/live-products/night-shift", { method: "PUT", body: "{}", headers }), { db, env, context, live });
  assert.equal((await put({}, { deploy: { context: "production" } })).status, 401);
  assert.equal((await put({ authorization: `Bearer ${token}` }, { deploy: { context: "deploy-preview" } })).status, 403);
  assert.equal((await put({ authorization: `Bearer ${token}` }, { deploy: { context: "production" } })).status, 200);
  assert.deepEqual(calls, ["night-shift"]);
});
