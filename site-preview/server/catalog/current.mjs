// The catalog a request should see: the built products plus anything
// published live since the last build (built entries always win), minus
// anything the owner removed from sale in the admin.
//
// - products / allowList: everything that may still be fulfilled. Paid orders
//   for a product removed from sale must still reach Apliiq.
// - saleProducts / saleAllowList: what shoppers can see and buy right now.
// - retiredKnown: false when the admin's removed list couldn't be read. The
//   build's list of products off sale (src/data/off-sale.json) then stands.
import products from "../../src/data/products.json" with { type: "json" };
import { AHA_FULFILLMENT_CATALOG } from "../fulfillment/catalog.mjs";
import { loadLiveCatalog } from "./live.mjs";
import { OFF_SALE } from "./off-sale.mjs";
import { loadRetired } from "./retired.mjs";

export const STATIC_PRODUCTS = products;

export async function currentCatalog(options = {}) {
  const [live, retired] = await Promise.all([
    loadLiveCatalog({ staticProducts: products, staticCatalog: AHA_FULFILLMENT_CATALOG, ...options }),
    loadRetired(options.retiredStore ? { store: options.retiredStore } : {}),
  ]);
  const all = [...products, ...live.products];
  const allowList = { ...live.allowList, ...AHA_FULFILLMENT_CATALOG };
  const retiredKnown = retired.known !== false;
  const removed = retiredKnown ? Object.keys(retired.products) : OFF_SALE;
  const retiredSlugs = new Set(removed.filter((slug) => all.some((product) => product.slug === slug)));
  const retiredVariations = all.filter((product) => retiredSlugs.has(product.slug)).flatMap((product) => product.variants.map((variant) => variant.id));
  const saleAllowList = Object.fromEntries(Object.entries(allowList).filter(([id]) => !retiredVariations.includes(id)));
  return {
    products: all,
    liveProducts: live.products,
    allowList,
    saleProducts: all.filter((product) => !retiredSlugs.has(product.slug)),
    saleLiveProducts: live.products.filter((product) => !retiredSlugs.has(product.slug)),
    saleAllowList,
    retired: [...retiredSlugs].map((slug) => retired.products[slug] ?? { slug }),
    retiredVariations,
    retiredKnown,
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
