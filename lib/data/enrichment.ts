// Server-side product enrichment: joins the live Square-sourced storefront product (by slug) to
// the internal manifest for fit/fabric/care copy, size guide, and per-size purchasable gating.
// Storefront still renders live Square display data; this only layers commerce-truth on top. (§18)
import { loadProducts, loadSizeGuides } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import type { SizeGuide } from "@/lib/types/product";

export interface ProductEnrichment {
  fitDescription: string;
  fabricDescription: string;
  careInstructions: string;
  garmentWeight?: string;
  productType: string;
  sizeGuide?: SizeGuide;
  /** size (upper-cased) -> purchasable result. Absent size = not offered / not mapped. */
  purchasableBySize: Record<string, { ok: boolean; reasons: string[] }>;
}

let cache: Map<string, ProductEnrichment> | null = null;

function build(): Map<string, ProductEnrichment> {
  const guides = new Map(loadSizeGuides().map((g) => [g.id, g]));
  const map = new Map<string, ProductEnrichment>();
  for (const p of loadProducts()) {
    const purchasableBySize: Record<string, { ok: boolean; reasons: string[] }> = {};
    for (const v of p.variants) {
      purchasableBySize[v.size.toUpperCase()] = checkVariantPurchasable(p, v);
    }
    map.set(p.slug, {
      fitDescription: p.fitDescription,
      fabricDescription: p.fabricDescription,
      careInstructions: p.careInstructions,
      garmentWeight: p.garmentWeight,
      productType: p.productType,
      sizeGuide: guides.get(p.sizeGuideId),
      purchasableBySize,
    });
  }
  return map;
}

export function getProductEnrichment(slug: string): ProductEnrichment | null {
  if (!cache) cache = build();
  return cache.get(slug) ?? null;
}
