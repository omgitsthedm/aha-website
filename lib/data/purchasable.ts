// Single source of truth for "can this variant be sold?" — used by both the build-time
// validation scripts (scripts/validate-*.ts) and runtime PDP add-to-cart gating (§13/§18).
// If this returns reasons, the variant is NOT purchasable and add-to-cart must be disabled.

import type { AhaProduct, AhaVariant } from "@/lib/types/product";

export interface ReadinessResult {
  ok: boolean;
  reasons: string[];
}

const MIN_PRODUCT_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35");

/** Full purchasable check for a variant in the context of its product. */
export function checkVariantPurchasable(
  product: AhaProduct,
  variant: AhaVariant
): ReadinessResult {
  const reasons: string[] = [];

  if (product.status !== "active") reasons.push("product not active");
  if (variant.status !== "active") reasons.push("variant not active");

  // Square mapping
  if (!variant.squareCatalogObjectId) reasons.push("missing Square catalog object id");
  if (!variant.squareVariationId) reasons.push("missing Square variation id");

  // Printful v2 mapping. Fulfillment uses the store sync-variant (art configured server-side);
  // a catalog file url/id is only required when there is no sync variant.
  if (!variant.printfulCatalogVariantId) reasons.push("missing Printful v2 catalog variant id");
  const placements = variant.printfulPlacements ?? [];
  if (placements.length === 0) reasons.push("missing Printful placement data");
  const hasArt =
    Boolean(variant.printfulSyncVariantId) || placements.some((p) => Boolean(p.fileUrl || p.fileId));
  if (!hasArt) reasons.push("missing print art (sync variant or file)");

  // Commercial fields
  if (!(variant.retailPrice > 0)) reasons.push("missing retail price");
  if (variant.costEstimate == null) {
    reasons.push("missing verified fulfillment cost");
  } else if ((variant.retailPrice - variant.costEstimate) / variant.retailPrice < MIN_PRODUCT_MARGIN_RATIO) {
    reasons.push(`product-cost margin below ${Math.round(MIN_PRODUCT_MARGIN_RATIO * 100)}% floor`);
  }
  if (!variant.size) reasons.push("missing size");
  if (!product.sizeGuideId) reasons.push("missing size guide");

  // Product-facing copy required before sale
  if (!product.productionNote) reasons.push("missing production note");
  if (!product.shippingNote) reasons.push("missing shipping note");
  if (!product.returnsNote) reasons.push("missing returns note");

  // Media + SEO
  if (!product.featuredImage) reasons.push("missing product image");
  if (!product.seoTitle || !product.seoDescription) reasons.push("missing SEO metadata");

  // Region availability
  const regions = variant.printfulRegionAvailability ?? [];
  if (regions.length === 0) reasons.push("missing region availability");

  return { ok: reasons.length === 0, reasons };
}

/** Convenience: is at least one variant purchasable for this product? */
export function productHasPurchasableVariant(product: AhaProduct): boolean {
  return product.variants.some((v) => checkVariantPurchasable(product, v).ok);
}
