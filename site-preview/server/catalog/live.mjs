// Live catalog: products published without a deploy. The publish engine writes
// one snapshot (Netlify Blobs) holding each product exactly as it will later
// appear in src/data/products.json, plus its fulfillment title. Pages, images,
// feeds, the cart and both allow lists read it at runtime. Anything already in
// the deployed build always wins, so a later deploy that includes the product
// changes nothing for shoppers.
import { getStore } from "@netlify/blobs";

export const STORE = "aha-catalog";
export const IMAGE_STORE = "aha-catalog-images";
const KEY = "products";
const SIZES = new Set(["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
const ROLES = ["front", "back", "print-detail", "folded"];
const SQUARE_ID = /^[A-Z0-9]{20,30}$/;
const SKU = /^APQ-(\d+)S(\d+)A1$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class LiveCatalogError extends Error {}

const fail = (message) => { throw new LiveCatalogError(message); };
const str = (value, name, max = 2000) => (typeof value === "string" && value.trim() && value.length <= max ? value : fail(`${name} is required (text up to ${max} characters).`));
const num = (value, name) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fail(`${name} must be a positive number.`));

/** Image path for this product's own folder: /images/<group>/<slug>/<file>. */
function imagePath(value, slug, name) {
  const pathValue = str(value, name, 300);
  const match = /^\/images\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+\.(?:webp|jpg|jpeg|png))$/.exec(pathValue);
  if (!match || match[2] !== slug) fail(`${name} must be an image in /images/<collection>/${slug}/.`);
  return pathValue;
}

export function validateLiveProduct(input) {
  if (!input || typeof input !== "object") fail("Product must be an object.");
  const slug = str(input.slug, "slug", 80);
  if (!SLUG.test(slug)) fail("slug must be lowercase words joined by hyphens.");
  for (const field of ["title", "color", "description", "fit", "composition", "measurementGuidance", "collection", "typeLabel", "fabricType", "gender"]) str(input[field], field);
  if (input.sleeveMeasurementGuidance != null && (typeof input.sleeveMeasurementGuidance !== "string" || input.sleeveMeasurementGuidance.length > 2000)) fail("sleeveMeasurementGuidance must be text.");
  if (!Number.isSafeInteger(input.price) || input.price <= 0 || input.price > 1000) fail("price must be whole dollars between 1 and 1000.");
  if (input.currency !== "USD") fail("currency must be USD.");
  if (!SQUARE_ID.test(input.squareItemId ?? "")) fail("squareItemId must be a Square item id.");
  str(input.feed?.googleProductCategory, "feed.googleProductCategory");
  str(input.feed?.productType, "feed.productType");
  num(input.weightOz, "weightOz");
  if (!Array.isArray(input.constructionDetails)) fail("constructionDetails must be a list.");
  input.constructionDetails.forEach((detail, index) => str(detail, `constructionDetails[${index}]`, 300));
  if (!Array.isArray(input.sizeGuide) || !input.sizeGuide.length) fail("sizeGuide is required.");
  for (const row of input.sizeGuide) {
    if (!SIZES.has(row?.size)) fail(`sizeGuide size ${row?.size} is not supported.`);
    num(row.chestWidth, `${row.size} chestWidth`);
    num(row.bodyLength, `${row.size} bodyLength`);
    if ("sleeveLength" in row) num(row.sleeveLength, `${row.size} sleeveLength`);
  }
  if (!Array.isArray(input.gallery) || input.gallery.length !== 4) fail("gallery needs exactly four garment images.");
  // One of each view; back-print designs lead with the back.
  if (new Set(input.gallery.map((shot) => shot?.role)).size !== 4 || !input.gallery.every((shot) => ROLES.includes(shot?.role))) fail(`gallery needs one each of ${ROLES.join(", ")}.`);
  input.gallery.forEach((shot, index) => {
    imagePath(shot.src, slug, `gallery[${index}].src`);
    imagePath(shot.feedImage, slug, `gallery[${index}].feedImage`);
    str(shot.srcset, `gallery[${index}].srcset`, 1000).split(",").forEach((part) => imagePath(part.trim().split(/\s+/)[0], slug, `gallery[${index}].srcset`));
    if (!Number.isSafeInteger(shot.width) || !Number.isSafeInteger(shot.height) || shot.width < 1 || shot.height < 1) fail(`gallery[${index}] needs pixel width and height.`);
    str(shot.alt, `gallery[${index}].alt`, 300);
  });
  if (!Array.isArray(input.variants) || input.variants.length < 1 || input.variants.length > SIZES.size) fail("variants must list each size.");
  const designs = new Set();
  const seen = new Set();
  for (const variant of input.variants) {
    if (!SQUARE_ID.test(variant?.id ?? "")) fail(`variant ${variant?.size} needs a Square variation id.`);
    if (!SIZES.has(variant.size) || seen.has(variant.size)) fail(`variant size ${variant.size} is unsupported or repeated.`);
    const sku = SKU.exec(variant.sku ?? "");
    if (!sku) fail(`variant ${variant.size} needs a decorated Apliiq SKU.`);
    designs.add(sku[1]);
    seen.add(variant.size);
  }
  if (designs.size !== 1) fail("every size must belong to one Apliiq design.");
  str(input.fulfillment?.product, "fulfillment.product", 80);
  str(input.fulfillment?.title, "fulfillment.title", 120);
  return input;
}

/** Allow-list entries for live products whose variations aren't already deployed. */
export function liveAllowList(products, staticCatalog) {
  const out = {};
  for (const product of products) {
    for (const variant of product.variants) {
      if (staticCatalog[variant.id]) continue;
      out[variant.id] = { sku: variant.sku, size: variant.size, priceCents: product.price * 100, product: product.fulfillment.product, title: product.fulfillment.title };
    }
  }
  return out;
}

/** Live products that the deployed build doesn't already contain. */
export function liveOnly(snapshot, staticProducts) {
  const deployed = new Set(staticProducts.map((product) => product.slug));
  const deployedVariants = new Set(staticProducts.flatMap((product) => product.variants.map((variant) => variant.id)));
  return Object.values(snapshot?.products ?? {})
    .filter((product) => !deployed.has(product.slug) && product.variants.every((variant) => !deployedVariants.has(variant.id)))
    .sort((a, b) => String(a.publishedAt ?? "").localeCompare(String(b.publishedAt ?? "")) || a.slug.localeCompare(b.slug));
}

export const catalogStore = () => getStore({ name: STORE, consistency: "strong" });
export const imageStore = () => getStore({ name: IMAGE_STORE, consistency: "strong" });

export async function readSnapshot(store = catalogStore()) {
  const value = await store.get(KEY, { type: "json" });
  return value && typeof value === "object" ? value : { schemaVersion: 1, products: {} };
}

export async function upsertLiveProduct(product, { store = catalogStore(), now = () => new Date() } = {}) {
  validateLiveProduct(product);
  const snapshot = await readSnapshot(store);
  const existing = snapshot.products[product.slug];
  const stamped = { ...product, publishedAt: existing?.publishedAt ?? now().toISOString(), updatedAt: now().toISOString() };
  const next = { schemaVersion: 1, updatedAt: now().toISOString(), products: { ...snapshot.products, [product.slug]: stamped } };
  await store.setJSON(KEY, next);
  return stamped;
}

export async function removeLiveProduct(slug, { store = catalogStore(), now = () => new Date() } = {}) {
  const snapshot = await readSnapshot(store);
  if (!snapshot.products[slug]) return false;
  const { [slug]: _removed, ...rest } = snapshot.products;
  await store.setJSON(KEY, { schemaVersion: 1, updatedAt: now().toISOString(), products: rest });
  return true;
}

let memo = null;
/**
 * Snapshot for request handling, memoized per function instance for ttlMs.
 * Any read failure returns an empty catalog: live products become briefly
 * unavailable, deployed products are never affected (fail closed).
 */
export async function loadLiveCatalog({ staticProducts, staticCatalog, store, ttlMs = 30_000, now = Date.now } = {}) {
  if (memo && memo.expires > now() && memo.staticProducts === staticProducts) return memo.value;
  let snapshot;
  try { snapshot = await readSnapshot(store ?? catalogStore()); }
  catch { snapshot = { schemaVersion: 1, products: {} }; }
  const products = liveOnly(snapshot, staticProducts).filter((product) => {
    try { validateLiveProduct(product); return true; } catch { return false; }
  });
  const value = { products, allowList: liveAllowList(products, staticCatalog) };
  memo = { value, expires: now() + ttlMs, staticProducts };
  return value;
}
export function resetLiveCatalogMemo() { memo = null; }
