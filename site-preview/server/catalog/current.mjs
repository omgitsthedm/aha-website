// The catalog a request should see: the built products plus anything
// published live since the last build. Built entries always win.
import products from "../../src/data/products.json" with { type: "json" };
import { AHA_FULFILLMENT_CATALOG } from "../fulfillment/catalog.mjs";
import { loadLiveCatalog } from "./live.mjs";

export const STATIC_PRODUCTS = products;

export async function currentCatalog(options = {}) {
  const live = await loadLiveCatalog({ staticProducts: products, staticCatalog: AHA_FULFILLMENT_CATALOG, ...options });
  return {
    products: [...products, ...live.products],
    liveProducts: live.products,
    allowList: { ...live.allowList, ...AHA_FULFILLMENT_CATALOG },
  };
}

/** CDN caching for catalog responses; publishing purges these tags. */
export function catalogCacheHeaders(tags) {
  return {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, durable, s-maxage=31536000, stale-while-revalidate=86400",
    "Netlify-Cache-Tag": ["catalog", ...tags].join(","),
  };
}
