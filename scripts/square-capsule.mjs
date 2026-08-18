#!/usr/bin/env node
/**
 * Square side of the capsule — one command per step, all keyed by the product
 * slug in data/apliiq-capsule.json. Needs SQUARE_ACCESS_TOKEN (and optionally
 * SQUARE_API_VERSION) in the environment; `netlify dev:exec --context
 * production -- node scripts/square-capsule.mjs …` supplies them.
 *
 *   create <slug>    Create the ITEM with one variation per size (sizes come
 *                    from data/apliiq-capsule-designs.json when the APLIIQ design
 *                    exists, else from the spec's `sizes`), upload the three
 *                    images from public/products/<slug>/, set the story, and
 *                    write the Square ids back into the spec under `square`.
 *   images <slug>    Replace the item's images with public/products/<slug>/*.jpg
 *                    (front first, then detail, art, then any extra files).
 *   copy <slug>      Push the spec's `story` HTML into the item description.
 *   manifest <slug>  Upsert the product's row in data/product-manifest.json from
 *                    the spec + Square ids (then run `npm run generate:sellable-slugs`).
 *
 * Nothing here talks to APLIIQ; that is scripts/apliiq-capsule.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = path.join(ROOT, "data", "apliiq-capsule.json");
const DESIGNS_PATH = path.join(ROOT, "data", "apliiq-capsule-designs.json");
const MANIFEST_PATH = path.join(ROOT, "data", "product-manifest.json");
const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const VERSION = process.env.SQUARE_API_VERSION || "2025-01-23";
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, v) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
const headers = () => ({ Authorization: `Bearer ${TOKEN}`, "Square-Version": VERSION, "Content-Type": "application/json" });

async function sq(pathname, options = {}) {
  if (!TOKEN) throw new Error("SQUARE_ACCESS_TOKEN is required.");
  const response = await fetch(`https://connect.squareup.com/v2${pathname}`, { headers: headers(), ...options });
  const json = await response.json();
  if (!response.ok) throw new Error(`${pathname} ${response.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

function product(slug) {
  const spec = readJson(SPEC_PATH);
  const found = spec.products.find((p) => p.slug === slug);
  if (!found) throw new Error(`${slug} is not in ${path.relative(ROOT, SPEC_PATH)}`);
  return { spec, product: found };
}

function sizesFor(p) {
  try {
    const designs = readJson(DESIGNS_PATH).designs;
    if (designs[p.slug]) {
      return designs[p.slug].variants.map((v) => v.size.toUpperCase().replace(/^XXL$/, "2XL").replace(/^XXXL$/, "3XL"));
    }
  } catch { /* no designs recorded yet */ }
  if (Array.isArray(p.sizes) && p.sizes.length) return p.sizes;
  throw new Error(`${p.slug}: no APLIIQ design recorded and no \`sizes\` in the spec.`);
}

const skuBase = (slug) => `AHA-${slug.toUpperCase()}`;
const itemName = (p) => `${p.title} — ${p.productType === "tee" ? "Tee" : p.productType === "hoodie" && p.imageKind === "crew" ? "Sweatshirt" : "Hoodie"}`;

async function uploadImage(itemId, file, name, isPrimary) {
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify({ idempotency_key: randomUUID(), object_id: itemId, is_primary: isPrimary, image: { type: "IMAGE", id: "#img", image_data: { name, caption: name } } })], { type: "application/json" }));
  form.append("image_file", new Blob([fs.readFileSync(file)], { type: "image/jpeg" }), path.basename(file));
  const response = await fetch("https://connect.squareup.com/v2/catalog/images", { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": VERSION }, body: form });
  const json = await response.json();
  if (!response.ok) throw new Error(`image ${response.status} ${JSON.stringify(json).slice(0, 300)}`);
  return { id: json.image.id, url: json.image.image_data.url };
}

function imageFiles(slug) {
  const dir = path.join(ROOT, "public", "products", slug);
  if (!fs.existsSync(dir)) throw new Error(`No imagery at public/products/${slug}/ — run scripts/imagery/render-product-imagery.py ${slug} or drop the shoot there.`);
  const preferred = ["front", "detail", "art"];
  const all = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f) && !/ 2\./.test(f));
  return [
    ...preferred.map((name) => all.find((f) => f.replace(/\.(jpe?g|png)$/i, "") === name)).filter(Boolean),
    ...all.filter((f) => !preferred.includes(f.replace(/\.(jpe?g|png)$/i, ""))).sort(),
  ].map((f) => path.join(dir, f));
}

async function setImages(slug, itemId) {
  const before = await sq(`/catalog/object/${itemId}`, { method: "GET" });
  const old = before.object.item_data.image_ids || [];
  const uploaded = [];
  for (const [index, file] of imageFiles(slug).entries()) {
    uploaded.push(await uploadImage(itemId, file, `${slug} ${path.basename(file, path.extname(file))}`, index === 0));
  }
  const current = await sq(`/catalog/object/${itemId}`, { method: "GET" });
  const object = current.object;
  object.item_data.image_ids = uploaded.map((u) => u.id);
  await sq("/catalog/object", { method: "POST", body: JSON.stringify({ idempotency_key: randomUUID(), object }) });
  for (const id of old) {
    if (!uploaded.some((u) => u.id === id)) {
      try { await sq(`/catalog/object/${id}`, { method: "DELETE" }); } catch { /* already gone */ }
    }
  }
  return uploaded;
}

async function setCopy(p, itemId) {
  if (!p.story) throw new Error(`${p.slug}: spec has no \`story\`.`);
  const current = await sq(`/catalog/object/${itemId}`, { method: "GET" });
  const object = current.object;
  object.item_data.description_html = p.story;
  delete object.item_data.description;
  delete object.item_data.description_plaintext;
  await sq("/catalog/object", { method: "POST", body: JSON.stringify({ idempotency_key: randomUUID(), object }) });
}

async function create(slug) {
  const { spec, product: p } = product(slug);
  if (p.square?.itemId) throw new Error(`${slug} already has Square item ${p.square.itemId}; use images/copy/manifest.`);
  const sizes = sizesFor(p);
  const objects = [{
    type: "ITEM", id: `#${slug}`, present_at_all_locations: true,
    item_data: {
      name: itemName(p), product_type: "REGULAR", is_taxable: true, description_html: p.story ?? "",
      variations: sizes.map((size, ordinal) => ({
        type: "ITEM_VARIATION", id: `#${slug}-${size.toLowerCase()}`, present_at_all_locations: true,
        item_variation_data: { item_id: `#${slug}`, name: size, sku: `${skuBase(slug)}-${size}`, ordinal, pricing_type: "FIXED_PRICING",
          price_money: { amount: p.sizeRetail?.[size] ?? p.retailPrice, currency: "USD" }, track_inventory: false },
      })),
    },
  }];
  const result = await sq("/catalog/batch-upsert", { method: "POST", body: JSON.stringify({ idempotency_key: `aha-${slug}-${randomUUID()}`, batches: [{ objects }] }) });
  const ids = Object.fromEntries((result.id_mappings || []).map((m) => [m.client_object_id, m.object_id]));
  p.square = { itemId: ids[`#${slug}`], variations: Object.fromEntries(sizes.map((size) => [size, ids[`#${slug}-${size.toLowerCase()}`]])) };
  writeJson(SPEC_PATH, spec);
  console.log(`created ${itemName(p)} → ${p.square.itemId} (${sizes.length} sizes)`);
  const uploaded = await setImages(slug, p.square.itemId);
  console.log(`  ${uploaded.length} images`);
  p.mockupUrl = uploaded[0]?.url ?? p.mockupUrl;
  writeJson(SPEC_PATH, spec);
}

function manifest(slug) {
  const { product: p } = product(slug);
  if (!p.square?.itemId || !p.square?.variations) throw new Error(`${slug}: run create first (needs Square ids in the spec).`);
  const manifestDoc = readJson(MANIFEST_PATH);
  const sizes = Object.keys(p.square.variations).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  const plain = (p.story ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const row = {
    ahaProductId: slug, slug, title: p.title,
    // First paragraph of the story, or the title.
    shortDescription: (p.story ?? "").match(/<p>(.*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, "").trim() || `${p.title}.`,
    fullDescription: plain,
    productType: p.productType, category: p.productType === "tee" ? "t-shirts" : "hoodies-sweatshirts",
    gender: ["men", "women", "unisex"], collectionIds: ["capsule-2026"], status: "active",
    retailPrice: p.retailPrice, currency: "USD",
    fitDescription: p.productType === "tee" ? "Modern fit, true to size." : "Relaxed fit, true to size.",
    fabricDescription: p.fabricDescription, printMethod: "DTF",
    careInstructions: "Machine wash cold inside out, tumble dry low.",
    productionNote: "Made to order.", shippingNote: "Free US shipping; $25 flat rate international.", returnsNote: "30 days.",
    sizeGuideId: p.sizeGuideId,
    featuredImage: `/products/${slug}/front.jpg`, galleryImages: [`/products/${slug}/front.jpg`, `/products/${slug}/detail.jpg`, `/products/${slug}/art.jpg`],
    seoTitle: `${p.title} | After Hours Agenda`, seoDescription: `${p.title}. Designed in NYC and printed to order.`,
    ogImage: `/products/${slug}/front.jpg`, badges: [], sortPriority: 0,
    variants: sizes.map((size, sortOrder) => ({
      ahaVariantId: `${slug}-${size.toLowerCase()}`, ahaProductId: slug, sku: `${skuBase(slug)}-${size}`, size, color: "Black",
      retailPrice: p.sizeRetail?.[size] ?? p.retailPrice, currency: "USD", status: "active", sortOrder,
      fulfillmentProvider: "apliiq", squareCatalogObjectId: p.square.itemId, squareVariationId: p.square.variations[size],
    })),
  };
  const index = manifestDoc.products.findIndex((entry) => entry.slug === slug);
  if (index >= 0) manifestDoc.products[index] = { ...manifestDoc.products[index], ...row };
  else manifestDoc.products.push(row);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifestDoc, null, 2)}\n`);
  console.log(`${index >= 0 ? "updated" : "added"} manifest row for ${slug} — now run: npm run generate:sellable-slugs`);
}

async function main() {
  const [command, slug] = process.argv.slice(2);
  if (!command || !slug) {
    console.error("usage: node scripts/square-capsule.mjs create|images|copy|manifest <slug>");
    process.exit(2);
  }
  if (command === "create") return create(slug);
  if (command === "manifest") return manifest(slug);
  const { product: p } = product(slug);
  if (!p.square?.itemId) throw new Error(`${slug}: no Square item yet — run create.`);
  if (command === "images") { const uploaded = await setImages(slug, p.square.itemId); console.log(`${uploaded.length} images set on ${p.square.itemId}`); return; }
  if (command === "copy") { await setCopy(p, p.square.itemId); console.log(`story set on ${p.square.itemId}`); return; }
  throw new Error(`unknown command ${command}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
