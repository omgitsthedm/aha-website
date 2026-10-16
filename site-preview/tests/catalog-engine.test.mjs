import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AHA_FULFILLMENT_CATALOG } from "../server/fulfillment/catalog.mjs";
import { designPayload, signature, withIntent } from "../tools/catalog/apliiq.mjs";
import { renderFulfillmentCatalog } from "../tools/catalog/generate.mjs";
import { fulfillmentFromLedger, ledgerFromLive, validateLedger } from "../tools/catalog/ledger.mjs";
import { expectedSku } from "../tools/catalog/lib.mjs";
import { marginReport } from "../tools/catalog/margin.mjs";
import { itemObject, verifyItem } from "../tools/catalog/square.mjs";

const read = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8"));
const ledger = read("../catalog/ledger.json");
const products = read("../src/data/products.json");
const costs = read("../catalog/costs.json");
const sorted = (object) => JSON.stringify(Object.entries(object).sort());

test("the ledger reproduces the live fulfillment allow list exactly", () => {
  assert.equal(sorted(fulfillmentFromLedger(ledger)), sorted(AHA_FULFILLMENT_CATALOG));
  assert.equal(sorted(fulfillmentFromLedger(ledgerFromLive({ products, fulfillment: AHA_FULFILLMENT_CATALOG }))), sorted(AHA_FULFILLMENT_CATALOG));
  assert.deepEqual(validateLedger(ledger), []);
});

test("the allow list file is generated from the ledger, never hand-edited", () => {
  const onDisk = readFileSync(new URL("../server/fulfillment/catalog.mjs", import.meta.url), "utf8");
  assert.equal(onDisk, renderFulfillmentCatalog(ledger));
});

test("every live product page is in the ledger with matching ids, SKUs and prices", () => {
  const bySlug = new Map(ledger.products.map((entry) => [entry.slug, entry]));
  for (const product of products) {
    const entry = bySlug.get(product.slug);
    assert.ok(entry, product.slug);
    assert.equal(entry.square.itemId, product.squareItemId);
    for (const variant of product.variants) {
      const saved = entry.variants.find((row) => row.variationId === variant.id);
      assert.equal(saved?.sku, variant.sku);
      assert.equal(saved?.priceCents, Math.round(product.price * 100));
    }
  }
});

test("Apliiq SKUs follow the decorated size codes", () => {
  assert.equal(expectedSku(6211442, "XS"), "APQ-6211442S5A1");
  assert.equal(expectedSku(6211442, "3XL"), "APQ-6211442S21A1");
  assert.equal(expectedSku(6209275, "5XL"), "APQ-6209275S62A1");
  assert.throws(() => expectedSku(1, "6XL"), /Unknown size/);
});

test("Apliiq requests are HMAC signed over key, timestamp, nonce and body", () => {
  const header = signature({ apiKey: "key", sharedSecret: "secret" }, "{}", { timestamp: 1, nonce: "n" });
  assert.match(header, /^x-apliiq-auth 1:[A-Za-z0-9+/=]+:key:n$/);
});

test("an uncertain Apliiq create blocks every retry until reconciled", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "aha-intents-"));
  let calls = 0;
  await assert.rejects(withIntent("design-x", { a: 1 }, async () => { calls += 1; throw Object.assign(new Error("timeout"), { code: "apliiq_uncertain" }); }, { directory }));
  await assert.rejects(withIntent("design-x", { a: 1 }, async () => { calls += 1; return { Id: 1 }; }, { directory }), /uncertain intent/);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(readFileSync(path.join(directory, "design-x.json"), "utf8")).state, "uncertain");
});

test("a completed intent returns its saved response without calling Apliiq again", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "aha-intents-"));
  writeFileSync(path.join(directory, "artwork-y.json"), JSON.stringify({ state: "complete", response: { Id: 42 } }));
  let calls = 0;
  const response = await withIntent("artwork-y", {}, async () => { calls += 1; return { Id: 7 }; }, { directory });
  assert.equal(response.Id, 42);
  assert.equal(calls, 0);
});

const spec = {
  slug: "pet-it-be-ss3000-test", title: "Pet It Be Crewneck", color: "Cranberry", priceCents: 5500, blank: "SS3000",
  sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"], description: "Test.",
  apliiq: { productId: 391, productCode: "code", colorId: 1, label: { id: 6208403, placementId: 1011, placementName: "inside neck" }, artwork: [{ key: "front", id: 9 }], locations: [{ id: 4546, imagePath: "https://example.test/a.png", artworkKey: "front", service: "dtgprint", note: "Front" }] },
};

test("design payload always carries the approved inside-neck private label", () => {
  const payload = designPayload(spec, { front: 9 });
  assert.deepEqual(payload.Subscriptions, [{ Placement: { Id: 1011, Name: "inside neck" }, Label: { Id: 6208403 } }]);
  assert.equal(payload.Locations[0].Artworks[0].Id, 9);
  assert.equal(payload.Name, "Pet It Be Crewneck — Cranberry");
});

test("margin gate passes a $55 crewneck and blocks a $35 one", () => {
  assert.equal(marginReport(spec, costs).pass, true);
  const cheap = marginReport({ ...spec, priceCents: 3500 }, costs);
  assert.equal(cheap.pass, false);
  assert.equal(cheap.worstSize, "3XL");
  assert.throws(() => marginReport({ ...spec, blank: "UNKNOWN" }, costs), /no cost record/);
});

test("Square readback must match every requested size, SKU and price", () => {
  const skus = Object.fromEntries(spec.sizes.map((size) => [size, expectedSku(6300000, size)]));
  const object = itemObject(spec, skus);
  const item = { type: "ITEM", id: "ITEM1", item_data: { name: object.item_data.name, variations: object.item_data.variations.map((variation, index) => ({ ...variation, id: `VAR${index}` })) } };
  const ids = verifyItem(spec, skus, item);
  assert.equal(ids.XS, "VAR0");
  const wrongPrice = structuredClone(item);
  wrongPrice.item_data.variations[2].item_variation_data.price_money.amount = 100;
  assert.throws(() => verifyItem(spec, skus, wrongPrice), /readback mismatch/);
});

test("garment images become the storefront's WebP/JPEG set and gallery entries", async () => {
  const sharp = (await import("sharp")).default;
  const { buildGallery, collectionSlug } = await import("../tools/catalog/images.mjs");
  const { rmSync } = await import("node:fs");
  const directory = mkdtempSync(path.join(tmpdir(), "aha-img-"));
  const file = path.join(directory, "front.png");
  await sharp({ create: { width: 900, height: 1125, channels: 3, background: "#7a1f2b" } }).png().toFile(file);
  const slug = "zz-engine-test";
  const gallery = await buildGallery({ slug, collection: "Pet It Be", title: "Pet It Be Crewneck", color: "Cranberry", inputs: [file] });
  try {
    assert.equal(collectionSlug("Mighty Mick’s"), "mighty-micks");
    assert.equal(gallery.length, 1);
    assert.equal(gallery[0].role, "front");
    assert.equal(gallery[0].width, 900);
    assert.equal(gallery[0].height, 1125);
    assert.match(gallery[0].srcset, /-400\.webp 400w, .*-800\.webp 800w, .*-900\.webp 900w$/);
    assert.equal(gallery[0].feedImage, `/images/pet-it-be/${slug}/garment-front.jpg`);
  } finally {
    rmSync(new URL(`../public/images/pet-it-be/${slug}`, import.meta.url), { recursive: true, force: true });
    const { readdirSync, rmdirSync } = await import("node:fs");
    const collectionDir = new URL("../public/images/pet-it-be", import.meta.url);
    if (!readdirSync(collectionDir).length) rmdirSync(collectionDir);
  }
});

test("ship refuses an approved design without its four garment and three campaign images, before any provider call", async () => {
  const { spawnSync } = await import("node:child_process");
  const { rmSync } = await import("node:fs");
  const file = new URL("../catalog/designs/zz-ship-gate-test.json", import.meta.url);
  writeFileSync(file, JSON.stringify({
    slug: "zz-ship-gate-test", status: "approved", approval: { by: "test", at: "2026-10-16T00:00:00Z", note: "test" },
    title: "Gate Test Crewneck", color: "Maroon", priceCents: 5500, blank: "SS3000", fulfillment: { product: "zz_ship_gate_test" },
    apliiq: { designId: 6300000 }, product: { collection: "Gate Test", description: "Test.", gallery: [], campaign: [] },
  }));
  try {
    const result = spawnSync(process.execPath, ["tools/catalog/cli.mjs", "ship", "--skip-checks"], { cwd: new URL("..", import.meta.url), encoding: "utf8", env: { ...process.env, ADMIN_AUTOMATION_TOKEN: "", AHA_SQUARE_ACCESS_TOKEN: "", AHA_APLIIQ_API_KEY: "" } });
    assert.equal(result.status, 5);
    assert.match(result.stdout, /"code":"images_missing"/);
  } finally {
    rmSync(file, { force: true });
  }
});
