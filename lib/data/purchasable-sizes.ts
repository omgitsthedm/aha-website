import { getProductEnrichment } from "@/lib/data/enrichment";
import type { Product } from "@/lib/utils/types";

/**
 * Server-side helper for listing pages: slug -> upper-cased sizes that pass
 * the same enrichment purchasable gate the product page enforces. Products
 * without an enrichment record are omitted (quick add then falls back to the
 * live Square variations).
 */
export function getPurchasableSizesMap(products: Product[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const product of products) {
    const enrichment = getProductEnrichment(product.slug);
    if (!enrichment) continue;
    map[product.slug] = Object.entries(enrichment.purchasableBySize)
      .filter(([, result]) => result.ok)
      .map(([size]) => size.toUpperCase());
  }
  return map;
}

/** slug -> number of distinct sold colors (from the verified manifest). */
export function getColorCountMap(products: Product[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const product of products) {
    const enrichment = getProductEnrichment(product.slug);
    if (enrichment && enrichment.colors.length > 0) {
      map[product.slug] = enrichment.colors.length;
    }
  }
  return map;
}

/** slug -> distinct sold color names (for rendering swatch dots on cards). */
export function getColorNamesMap(products: Product[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const product of products) {
    const enrichment = getProductEnrichment(product.slug);
    if (enrichment && enrichment.colors.length > 0) {
      map[product.slug] = enrichment.colors;
    }
  }
  return map;
}
