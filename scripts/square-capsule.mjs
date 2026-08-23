#!/usr/bin/env node
/**
 * Square side of the capsule — one command per step, all keyed by the product
 * slug in data/apliiq-capsule.json. Needs SQUARE_ACCESS_TOKEN (and optionally
 * SQUARE_API_VERSION) in the environment; `netlify dev:exec --context
 * production -- node scripts/square-capsule.mjs …` supplies them.
 *
 * Every command is a dry run unless `--apply` is present. Create and image
 * requests use deterministic content-based Square idempotency keys, so retrying
 * an interrupted command converges instead of duplicating the item or image.
 * Detached images are never deleted or archived.
 *
 *   create <slug>    Converge the ITEM, variations, story, and local imagery;
 *                    resume from a Square mapping already written to the spec.
 *   images <slug>    Converge public/products/<slug> images (front, detail, art).
 *   copy <slug>      Converge the spec's `story` HTML on the item.
 *   manifest <slug>  Upsert only this product's local manifest row.
 *
 * Nothing here talks to APLIIQ; that is scripts/apliiq-capsule.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = path.join(ROOT, "data", "apliiq-capsule.json");
const DESIGNS_PATH = path.join(ROOT, "data", "apliiq-capsule-designs.json");
const MANIFEST_PATH = path.join(ROOT, "data", "product-manifest.json");
const CHECKPOINT_DIR = path.join(ROOT, "data", ".square-capsule-pending");
const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const VERSION = process.env.SQUARE_API_VERSION || "2025-01-23";
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const CHECKPOINT_VERSION = 1;
// Square documents a 24-hour idempotency window. Leave an hour of margin rather
// than risking a second create near the provider's retention boundary.
const SAFE_CREATE_RETRY_MS = 23 * 60 * 60 * 1000;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export function writeJsonAtomic(p, v) {
  const next = `${JSON.stringify(v, null, 2)}\n`;
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === next) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const temporary = `${p}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, next, { flag: "wx" });
    fs.renameSync(temporary, p);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
const writeJson = writeJsonAtomic;
const headers = () => ({ Authorization: `Bearer ${TOKEN}`, "Square-Version": VERSION, "Content-Type": "application/json" });

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Square caps idempotency keys at 45 characters. The digest is stable across retries. */
export function contentFingerprint(content) {
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}

export function contentIdempotencyKey(scope, content) {
  return `aha-${scope.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${contentFingerprint(content)}`.slice(0, 45);
}

const fileDigest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Record an attempted create before the POST. A matching recent checkpoint may
 * reuse exactly the same Square key. Any ambiguity outside Square's retention
 * window is a manual reconciliation, never a best-effort second create.
 */
export function prepareSquareCreateCheckpoint(checkpointPath, { slug, requestFingerprint, idempotencyKey }, now = new Date()) {
  const attemptedAt = now.toISOString();
  if (fs.existsSync(checkpointPath)) {
    let saved;
    try { saved = readJson(checkpointPath); } catch { throw new Error(`${slug}: Square create checkpoint is unreadable; reconcile Square before retrying.`); }
    if (saved?.version !== CHECKPOINT_VERSION || saved.slug !== slug || typeof saved.attemptedAt !== "string"
      || typeof saved.requestFingerprint !== "string" || typeof saved.idempotencyKey !== "string") {
      throw new Error(`${slug}: legacy or ambiguous Square create checkpoint requires provider reconciliation before retrying.`);
    }
    if (saved.requestFingerprint !== requestFingerprint) {
      throw new Error(`${slug}: source changed while a Square create is pending; reconcile the existing provider request before publishing changed content.`);
    }
    if (saved.idempotencyKey !== idempotencyKey) {
      throw new Error(`${slug}: pending Square checkpoint has a different idempotency key; reconcile before retrying.`);
    }
    const age = now.getTime() - Date.parse(saved.attemptedAt);
    if (!Number.isFinite(age) || age < 0 || age >= SAFE_CREATE_RETRY_MS) {
      throw new Error(`${slug}: pending Square create is outside the safe idempotency retry window; reconcile the provider catalog before retrying.`);
    }
    return saved;
  }
  const checkpoint = { version: CHECKPOINT_VERSION, slug, requestFingerprint, idempotencyKey, attemptedAt };
  writeJsonAtomic(checkpointPath, checkpoint);
  return checkpoint;
}

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

export function normalizeSquareSize(value) {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return upper.replace(/^XXL$/, "2XL").replace(/^XXXL$/, "3XL");
}

function sizesFor(p) {
  try {
    const designs = readJson(DESIGNS_PATH).designs;
    if (designs[p.slug]) {
      return designs[p.slug].variants.map((v) => normalizeSquareSize(v.size));
    }
  } catch { /* no designs recorded yet */ }
  if (Array.isArray(p.sizes) && p.sizes.length) return p.sizes.map(normalizeSquareSize);
  throw new Error(`${p.slug}: no APLIIQ design recorded and no \`sizes\` in the spec.`);
}

const skuBase = (slug) => `AHA-${slug.toUpperCase()}`;
const itemName = (p) => `${p.title} — ${p.productType === "tee" ? "Tee" : p.productType === "hoodie" && p.imageKind === "crew" ? "Sweatshirt" : "Hoodie"}`;
export const capsuleSeoDescription = (title) => `${title}. Made to order.`;

export function expectedSquareCommerce(p, expectedSizes) {
  const variations = Object.fromEntries(expectedSizes.map(normalizeSquareSize).map((size) => {
    const amount = p.sizeRetail?.[size] ?? p.retailPrice;
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`${p.slug}/${size}: expected Square price must be positive integer cents.`);
    return [size, {
      name: size,
      sku: `${skuBase(p.slug)}-${size}`,
      pricingType: "FIXED_PRICING",
      amount,
      currency: "USD",
      trackInventory: false,
      presentAtAllLocations: true,
    }];
  }));
  return {
    item: { name: itemName(p), productType: "REGULAR", isTaxable: true, presentAtAllLocations: true },
    variations,
  };
}

/** Prove mapped IDs and immutable provider relationships before convergence. */
function mappedProviderVariations(slug, square, expectedSizes, object) {
  const itemId = square?.itemId;
  if (typeof itemId !== "string" || !itemId.trim()) throw new Error(`${slug}: no Square item mapping.`);
  if (!object || object.type !== "ITEM" || object.id !== itemId || object.is_deleted === true) {
    throw new Error(`${slug}: Square item mapping ${itemId} is stale or does not resolve to the expected live item.`);
  }
  const expected = expectedSizes.map(normalizeSquareSize);
  if (expected.some((size) => !size) || new Set(expected).size !== expected.length) {
    throw new Error(`${slug}: expected Square sizes are empty or duplicate after normalization.`);
  }
  if (!square.variations || typeof square.variations !== "object" || Array.isArray(square.variations)) {
    throw new Error(`${slug}: no Square variation mappings.`);
  }
  const expectedSet = new Set(expected);
  const savedBySize = new Map();
  const seenIds = new Set();
  for (const [savedSize, variationId] of Object.entries(square.variations)) {
    const size = normalizeSquareSize(savedSize);
    if (!size || !expectedSet.has(size)) throw new Error(`${slug}/${savedSize}: unexpected Square variation size mapping.`);
    if (savedSize !== size) throw new Error(`${slug}/${savedSize}: Square variation mapping key must use normalized size ${size}.`);
    if (savedBySize.has(size)) throw new Error(`${slug}/${size}: duplicate Square variation size mapping.`);
    if (typeof variationId !== "string" || !variationId.trim()) throw new Error(`${slug}/${size}: missing Square variation mapping.`);
    if (seenIds.has(variationId)) throw new Error(`${slug}/${size}: duplicate Square variation mapping ${variationId}.`);
    savedBySize.set(size, variationId);
    seenIds.add(variationId);
  }
  const providerVariations = object.item_data?.variations;
  if (!Array.isArray(providerVariations)) throw new Error(`${slug}: Square item ${itemId} has no provider variations.`);
  const providerById = new Map(providerVariations.map((variation) => [variation?.id, variation]));
  const mapped = new Map();
  for (const size of expected) {
    const variationId = savedBySize.get(size);
    if (!variationId) throw new Error(`${slug}/${size}: missing Square variation mapping.`);
    const variation = providerById.get(variationId);
    if (!variation || variation.type !== "ITEM_VARIATION" || variation.is_deleted === true) {
      throw new Error(`${slug}/${size}: Square variation mapping ${variationId} is stale or missing from item ${itemId}.`);
    }
    if (variation.item_variation_data?.item_id !== itemId) {
      throw new Error(`${slug}/${size}: Square variation ${variationId} does not belong to item ${itemId}.`);
    }
    mapped.set(size, variation);
  }
  return mapped;
}

/** Strict commerce validation used only after provider convergence and GET. */
export function validateSquareMapping(slug, square, expectedSizes, object, expectedCommerce) {
  const mapped = mappedProviderVariations(slug, square, expectedSizes, object);
  if (!expectedCommerce) return object;
  const item = object.item_data ?? {};
  const itemExpected = expectedCommerce.item;
  if (item.name !== itemExpected.name) throw new Error(`${slug}: Square item name is stale.`);
  if (item.product_type !== itemExpected.productType) throw new Error(`${slug}: Square item product type is stale.`);
  if (item.is_taxable !== itemExpected.isTaxable) throw new Error(`${slug}: Square item taxability is stale.`);
  if (object.present_at_all_locations !== itemExpected.presentAtAllLocations) throw new Error(`${slug}: Square item live presence is stale.`);
  for (const [size, variation] of mapped) {
    const data = variation.item_variation_data ?? {};
    const expected = expectedCommerce.variations[size];
    if (!expected) throw new Error(`${slug}/${size}: expected commerce fields are missing.`);
    if (data.name !== expected.name) throw new Error(`${slug}/${size}: Square variation name is stale.`);
    if (data.sku !== expected.sku) throw new Error(`${slug}/${size}: Square variation SKU is stale.`);
    if (data.pricing_type !== expected.pricingType) throw new Error(`${slug}/${size}: Square pricing type is stale.`);
    if (data.price_money?.amount !== expected.amount || data.price_money?.currency !== expected.currency) {
      throw new Error(`${slug}/${size}: Square fixed USD price is stale.`);
    }
    if (data.track_inventory !== expected.trackInventory) throw new Error(`${slug}/${size}: Square inventory setting is stale.`);
    if (variation.present_at_all_locations !== expected.presentAtAllLocations) throw new Error(`${slug}/${size}: Square variation live presence is stale.`);
  }
  return object;
}

export function convergeSquareCommerceObject(slug, square, expectedSizes, object, expectedCommerce) {
  if (!Number.isInteger(object?.version)) throw new Error(`${slug}: Square item has no version for a safe upsert.`);
  const mapped = mappedProviderVariations(slug, square, expectedSizes, object);
  const next = structuredClone(object);
  next.present_at_all_locations = expectedCommerce.item.presentAtAllLocations;
  next.item_data.name = expectedCommerce.item.name;
  next.item_data.product_type = expectedCommerce.item.productType;
  next.item_data.is_taxable = expectedCommerce.item.isTaxable;
  const nextById = new Map(next.item_data.variations.map((variation) => [variation.id, variation]));
  for (const [size, currentVariation] of mapped) {
    const variation = nextById.get(currentVariation.id);
    const expected = expectedCommerce.variations[size];
    variation.present_at_all_locations = expected.presentAtAllLocations;
    variation.item_variation_data.name = expected.name;
    variation.item_variation_data.sku = expected.sku;
    variation.item_variation_data.pricing_type = expected.pricingType;
    variation.item_variation_data.price_money = { amount: expected.amount, currency: expected.currency };
    variation.item_variation_data.track_inventory = expected.trackInventory;
  }
  return next;
}

async function verifySquareMapping(p, expectedSizes) {
  const current = await sq(`/catalog/object/${p.square?.itemId}`, { method: "GET" });
  return validateSquareMapping(p.slug, p.square, expectedSizes, current.object, expectedSquareCommerce(p, expectedSizes));
}

async function convergeAndVerifySquareMapping(p, expectedSizes) {
  const current = await sq(`/catalog/object/${p.square?.itemId}`, { method: "GET" });
  const expected = expectedSquareCommerce(p, expectedSizes);
  const next = convergeSquareCommerceObject(p.slug, p.square, expectedSizes, current.object, expected);
  if (stableStringify(next) !== stableStringify(current.object)) {
    await sq("/catalog/object", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: contentIdempotencyKey("capsule-commerce", { itemId: p.square.itemId, version: current.object.version, expected }),
        object: next,
      }),
    });
  }
  return verifySquareMapping(p, expectedSizes);
}

async function uploadImage(itemId, file, name, isPrimary) {
  if (!TOKEN) throw new Error("SQUARE_ACCESS_TOKEN is required.");
  const bytes = fs.readFileSync(file);
  const digest = fileDigest(bytes);
  const idempotencyKey = contentIdempotencyKey("capsule-image", { itemId, name, isPrimary, digest });
  const mime = /\.png$/i.test(file) ? "image/png" : "image/jpeg";
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify({ idempotency_key: idempotencyKey, object_id: itemId, is_primary: isPrimary, image: { type: "IMAGE", id: "#img", image_data: { name, caption: `${name} [sha256:${digest.slice(0, 16)}]` } } })], { type: "application/json" }));
  form.append("image_file", new Blob([bytes], { type: mime }), path.basename(file));
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
  const uploaded = [];
  for (const [index, file] of imageFiles(slug).entries()) {
    uploaded.push(await uploadImage(itemId, file, `${slug} ${path.basename(file, path.extname(file))}`, index === 0));
  }
  const current = await sq(`/catalog/object/${itemId}`, { method: "GET" });
  const object = current.object;
  const imageIds = uploaded.map((image) => image.id);
  const existingIds = object.item_data.image_ids || [];
  if (existingIds.length === imageIds.length && existingIds.every((id, index) => id === imageIds[index])) return uploaded;
  object.item_data.image_ids = imageIds;
  await sq("/catalog/object", {
    method: "POST",
    body: JSON.stringify({ idempotency_key: contentIdempotencyKey("capsule-image-list", { itemId, version: object.version, imageIds }), object }),
  });
  // Deliberately do not DELETE detached images. Publisher operations never
  // delete or archive provider records; cleanup is always a separate review.
  return uploaded;
}

async function setCopy(p, itemId) {
  if (!p.story) throw new Error(`${p.slug}: spec has no \`story\`.`);
  const current = await sq(`/catalog/object/${itemId}`, { method: "GET" });
  const object = current.object;
  if (object.item_data.description_html === p.story && !object.item_data.description && !object.item_data.description_plaintext) return;
  object.item_data.description_html = p.story;
  delete object.item_data.description;
  delete object.item_data.description_plaintext;
  await sq("/catalog/object", {
    method: "POST",
    body: JSON.stringify({ idempotency_key: contentIdempotencyKey("capsule-copy", { itemId, version: object.version, story: p.story }), object }),
  });
}

async function create(slug) {
  const { spec, product: p } = product(slug);
  const sizes = sizesFor(p);
  if (!p.story) throw new Error(`${slug}: spec has no \`story\`.`);
  if (!Number.isInteger(p.retailPrice) || p.retailPrice <= 0) throw new Error(`${slug}: spec needs a positive integer retailPrice in cents.`);
  const commerce = expectedSquareCommerce(p, sizes);
  imageFiles(slug);
  if (p.square?.itemId) {
    await convergeAndVerifySquareMapping(p, sizes);
    console.log(`${slug} already maps to ${p.square.itemId}; converged and verified live commerce fields, resuming image/copy convergence`);
    const uploaded = await setImages(slug, p.square.itemId);
    await setCopy(p, p.square.itemId);
    p.mockupUrl = uploaded[0]?.url ?? p.mockupUrl;
    writeJson(SPEC_PATH, spec);
    return;
  }
  const objects = [{
    type: "ITEM", id: `#${slug}`, present_at_all_locations: true,
    item_data: {
      name: commerce.item.name, product_type: commerce.item.productType, is_taxable: commerce.item.isTaxable, description_html: p.story ?? "",
      variations: sizes.map((size, ordinal) => {
        const expected = commerce.variations[size];
        return {
          type: "ITEM_VARIATION", id: `#${slug}-${size.toLowerCase()}`, present_at_all_locations: expected.presentAtAllLocations,
          item_variation_data: { item_id: `#${slug}`, name: expected.name, sku: expected.sku, ordinal, pricing_type: expected.pricingType,
            price_money: { amount: expected.amount, currency: expected.currency }, track_inventory: expected.trackInventory },
        };
      }),
    },
  }];
  const request = { batches: [{ objects }] };
  const requestFingerprint = contentFingerprint(request);
  const idempotencyKey = contentIdempotencyKey("capsule-item", request);
  const checkpointPath = path.join(CHECKPOINT_DIR, `${slug}.json`);
  prepareSquareCreateCheckpoint(checkpointPath, { slug, requestFingerprint, idempotencyKey });
  const result = await sq("/catalog/batch-upsert", {
    method: "POST",
    body: JSON.stringify({ idempotency_key: idempotencyKey, ...request }),
  });
  const ids = Object.fromEntries((result.id_mappings || []).map((m) => [m.client_object_id, m.object_id]));
  const square = { itemId: ids[`#${slug}`], variations: Object.fromEntries(sizes.map((size) => [size, ids[`#${slug}-${size.toLowerCase()}`]])) };
  const pendingProduct = { ...p, square };
  await verifySquareMapping(pendingProduct, sizes);
  p.square = square;
  writeJsonAtomic(SPEC_PATH, spec);
  if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
  console.log(`created and verified ${itemName(p)} → ${p.square.itemId} (${sizes.length} sizes)`);
  const uploaded = await setImages(slug, p.square.itemId);
  console.log(`  ${uploaded.length} images`);
  await setCopy(p, p.square.itemId);
  p.mockupUrl = uploaded[0]?.url ?? p.mockupUrl;
  writeJson(SPEC_PATH, spec);
}

const CURATED_MANIFEST_FIELDS = [
  "badges", "sortPriority", "collectionIds", "gender", "fitDescription", "careInstructions",
  "productionNote", "shippingNote", "returnsNote",
];

export function mergeCapsuleManifestRow(existing, generated) {
  if (!existing) return generated;
  const merged = { ...existing, ...generated };
  for (const key of CURATED_MANIFEST_FIELDS) {
    if (Object.hasOwn(existing, key)) merged[key] = existing[key];
  }
  for (const key of Object.keys(existing)) {
    if (/(?:lifestyle|drop|launch)/i.test(key)) merged[key] = existing[key];
  }
  const generatedGallery = Array.isArray(generated.galleryImages) ? generated.galleryImages : [];
  const existingGallery = Array.isArray(existing.galleryImages) ? existing.galleryImages : [];
  merged.galleryImages = [...generatedGallery, ...existingGallery.filter((image) => !generatedGallery.includes(image))];
  return merged;
}

async function manifest(slug) {
  const { product: p } = product(slug);
  if (!p.square?.itemId || !p.square?.variations) throw new Error(`${slug}: run create first (needs Square ids in the spec).`);
  const expectedSizes = sizesFor(p);
  await convergeAndVerifySquareMapping(p, expectedSizes);
  const manifestDoc = readJson(MANIFEST_PATH);
  const sizes = [...expectedSizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
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
    seoTitle: `${p.title} | After Hours Agenda`, seoDescription: capsuleSeoDescription(p.title),
    ogImage: `/products/${slug}/front.jpg`, badges: [], sortPriority: 0,
    variants: sizes.map((size, sortOrder) => ({
      ahaVariantId: `${slug}-${size.toLowerCase()}`, ahaProductId: slug, sku: `${skuBase(slug)}-${size}`, size, color: "Black",
      retailPrice: p.sizeRetail?.[size] ?? p.retailPrice, currency: "USD", status: "active", sortOrder,
      fulfillmentProvider: "apliiq", squareCatalogObjectId: p.square.itemId, squareVariationId: p.square.variations[size],
    })),
  };
  const index = manifestDoc.products.findIndex((entry) => entry.slug === slug);
  if (index >= 0) manifestDoc.products[index] = mergeCapsuleManifestRow(manifestDoc.products[index], row);
  else manifestDoc.products.push(mergeCapsuleManifestRow(undefined, row));
  writeJson(MANIFEST_PATH, manifestDoc);
  console.log(`${index >= 0 ? "updated" : "added"} manifest row for ${slug} — now run: npm run generate:sellable-slugs`);
}

function dryRun(command, slug) {
  const { product: p } = product(slug);
  if (!p.story) throw new Error(`${slug}: spec has no \`story\`.`);
  if (!Number.isInteger(p.retailPrice) || p.retailPrice <= 0) throw new Error(`${slug}: spec needs a positive integer retailPrice in cents.`);
  if (command === "create") {
    const sizes = sizesFor(p);
    expectedSquareCommerce(p, sizes);
    imageFiles(slug);
    console.log(`[dry run] ${p.square?.itemId ? `resume Square item ${p.square.itemId}` : `create ${itemName(p)}`} with ${sizes.length} variation(s), story, and local images`);
    return;
  }
  if (!p.square?.itemId) throw new Error(`${slug}: no Square item mapping.`);
  if (command === "images") { console.log(`[dry run] attach ${imageFiles(slug).length} content-keyed image(s) to ${p.square.itemId}; no images will be deleted`); return; }
  if (command === "copy") { console.log(`[dry run] converge authored story on ${p.square.itemId}`); return; }
  if (command === "manifest") {
    if (!p.square?.variations || Object.keys(p.square.variations).length === 0) throw new Error(`${slug}: no Square variation mappings.`);
    console.log(`[dry run] upsert the selected manifest row for ${slug}`);
    return;
  }
  throw new Error(`unknown command ${command}`);
}

async function main() {
  const [command, slug, ...flags] = process.argv.slice(2);
  if (!command || !slug || flags.some((flag) => flag !== "--apply")) {
    console.error("usage: node scripts/square-capsule.mjs create|images|copy|manifest <slug> [--apply]");
    process.exit(2);
  }
  if (!flags.includes("--apply")) return dryRun(command, slug);
  if (command === "create") return create(slug);
  if (command === "manifest") return manifest(slug);
  const { product: p } = product(slug);
  if (!p.square?.itemId) throw new Error(`${slug}: no Square item yet — run create --apply.`);
  if (command === "images") { const uploaded = await setImages(slug, p.square.itemId); console.log(`${uploaded.length} images set on ${p.square.itemId}`); return; }
  if (command === "copy") { await setCopy(p, p.square.itemId); console.log(`story set on ${p.square.itemId}`); return; }
  throw new Error(`unknown command ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
