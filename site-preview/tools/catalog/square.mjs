// Square Catalog client for the catalog engine. The item and every size
// variation are created in one request with a stable idempotency key, then read
// back before anything is recorded in the ledger.
import { readFileSync } from "node:fs";
import path from "node:path";
import { CatalogError, sha256 } from "./lib.mjs";

const API = "https://connect.squareup.com/v2";
const VERSION = "2026-09-16";

export function squareToken(env = process.env) {
  const token = env.AHA_SQUARE_ACCESS_TOKEN;
  if (!token) throw new CatalogError("AHA_SQUARE_ACCESS_TOKEN is required for Square calls.", { code: "square_credentials_missing", exit: 3 });
  return token;
}

export function createSquareClient({ token, fetchImpl = fetch, timeoutMs = 20_000 }) {
  const headers = { Authorization: `Bearer ${token}`, "Square-Version": VERSION, Accept: "application/json" };
  async function call(route, init = {}) {
    let response;
    try { response = await fetchImpl(`${API}${route}`, { ...init, headers: { ...headers, ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}) }, signal: AbortSignal.timeout(timeoutMs) }); }
    catch (error) { throw new CatalogError(`Square ${route} had no confirmed response (${error.name}).`, { code: "square_uncertain" }); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new CatalogError(`Square ${route} failed (${response.status}).`, { code: response.status === 429 ? "square_locked" : "square_rejected", details: data?.errors });
    return data;
  }
  return {
    readItem: async (itemId) => (await call(`/catalog/object/${encodeURIComponent(itemId)}`)).object,
    exactNameMatches: async (name) => {
      const data = await call("/catalog/search", { method: "POST", body: JSON.stringify({ object_types: ["ITEM"], query: { exact_query: { attribute_name: "name", attribute_value: name } } }) });
      return (data.objects ?? []).filter((object) => !object.is_deleted && object.item_data?.name === name);
    },
    createItem: async (object, idempotencyKey) => (await call("/catalog/object", { method: "POST", body: JSON.stringify({ idempotency_key: idempotencyKey, object }) })).catalog_object,
    uploadImage: async ({ itemId, file, name, caption, isPrimary, idempotencyKey }) => {
      const form = new FormData();
      form.set("request", JSON.stringify({ idempotency_key: idempotencyKey, object_id: itemId, is_primary: isPrimary, image: { type: "IMAGE", id: "#image", image_data: { name, caption } } }));
      form.set("file", new Blob([readFileSync(file)], { type: "image/jpeg" }), path.basename(file));
      return (await call("/catalog/images", { method: "POST", body: form })).image;
    },
  };
}

export function itemObject(spec, skus) {
  const name = `${spec.title} — ${spec.color}`;
  return {
    type: "ITEM",
    id: `#${spec.slug}`,
    present_at_all_locations: true,
    item_data: {
      name,
      description: spec.description,
      variations: spec.sizes.map((size, index) => ({
        type: "ITEM_VARIATION",
        id: `#${spec.slug}-v${index + 1}`,
        item_variation_data: { name: size, sku: skus[size], pricing_type: "FIXED_PRICING", price_money: { amount: spec.priceCents, currency: "USD" } },
      })),
    },
  };
}

/** Confirm Square stored exactly what was requested; return size → variation id. */
export function verifyItem(spec, skus, item) {
  const name = `${spec.title} — ${spec.color}`;
  if (item?.type !== "ITEM" || item.is_deleted || item.item_data?.name !== name) throw new CatalogError(`${spec.slug}: Square readback does not match the requested item.`, { code: "square_readback_mismatch" });
  const bySize = new Map((item.item_data.variations ?? []).map((variation) => [variation.item_variation_data?.name, variation]));
  const ids = {};
  for (const size of spec.sizes) {
    const variation = bySize.get(size);
    const data = variation?.item_variation_data;
    if (!variation || data?.sku !== skus[size] || data?.price_money?.amount !== spec.priceCents) throw new CatalogError(`${spec.slug} ${size}: Square variation readback mismatch.`, { code: "square_readback_mismatch" });
    ids[size] = variation.id;
  }
  if (bySize.size !== spec.sizes.length) throw new CatalogError(`${spec.slug}: Square has unexpected extra variations.`, { code: "square_readback_mismatch" });
  return ids;
}

export const squareIdempotencyKey = (spec, skus) => `aha-catalog-${spec.slug}-${sha256({ slug: spec.slug, skus, price: spec.priceCents, title: spec.title, color: spec.color }).slice(0, 24)}`;
