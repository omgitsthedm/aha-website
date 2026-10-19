// Products the owner removed from sale in the admin. Removal takes effect at
// once with no site build: the shop, product pages, bag, feeds and checkout
// stop offering them, while already-paid orders still reach Apliiq (the
// fulfillment allow list keeps them). The catalog engine later deletes the
// product from the code so the next build drops its static page.
import { catalogStore } from "./live.mjs";

const KEY = "retired";

export async function readRetired(store = catalogStore()) {
  const value = await store.get(KEY, { type: "json" });
  return value && typeof value === "object" && value.products && typeof value.products === "object" ? value : { products: {} };
}

export async function markRetired(slug, { by, store = catalogStore(), now = () => new Date() } = {}) {
  const current = await readRetired(store);
  const entry = { ...(current.products[slug] ?? {}), slug, retiredAt: current.products[slug]?.retiredAt ?? now().toISOString(), by: by ?? null };
  await store.setJSON(KEY, { products: { ...current.products, [slug]: entry } });
  resetRetiredMemo();
  return entry;
}

export async function markRestored(slug, { store = catalogStore() } = {}) {
  const current = await readRetired(store);
  if (!current.products[slug]) return false;
  const { [slug]: _removed, ...rest } = current.products;
  await store.setJSON(KEY, { products: rest });
  resetRetiredMemo();
  return true;
}

export async function noteApliiqDeleted(slug, designId, { store = catalogStore(), now = () => new Date() } = {}) {
  const current = await readRetired(store);
  const entry = { ...current.products[slug], apliiqDesignId: designId, apliiqDeletedAt: now().toISOString() };
  await store.setJSON(KEY, { products: { ...current.products, [slug]: entry } });
  resetRetiredMemo();
  return entry;
}

let memo = null;
/**
 * Memoized per function instance. `known` is false when the store couldn't be
 * read: callers then keep the build's list of products off sale
 * (src/data/off-sale.json) instead of treating everything as on sale.
 */
export async function loadRetired({ store, ttlMs = 30_000, now = Date.now } = {}) {
  if (memo && memo.expires > now()) return memo.value;
  let value;
  try { value = { ...(await readRetired(store ?? catalogStore())), known: true }; } catch { value = { products: {}, known: false }; }
  // A failed read is retried within seconds rather than held for the full memo time.
  memo = { value, expires: now() + (value.known ? ttlMs : Math.min(ttlMs, 5_000)) };
  return value;
}
export function resetRetiredMemo() { memo = null; }

/** Apliiq design id from a decorated SKU (APQ-<design>S<size>A1). */
export const designIdFromSku = (sku) => Number(/^APQ-(\d+)S\d+A1$/.exec(sku ?? "")?.[1]) || null;
