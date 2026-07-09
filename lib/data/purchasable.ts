// Single source of truth for "can this variant be sold?" — used by both the build-time
// validation scripts (scripts/validate-*.ts) and runtime PDP add-to-cart gating (§13/§18).
// If this returns reasons, the variant is NOT purchasable and add-to-cart must be disabled.

import type { AhaProduct, AhaVariant } from "@/lib/types/product";

export interface ReadinessResult {
  ok: boolean;
  reasons: string[];
}

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

  // Printful v2 mapping
  if (!variant.printfulCatalogVariantId) reasons.push("missing Printful v2 catalog variant id");
  const placements = variant.printfulPlacements ?? [];
  if (placements.length === 0) reasons.push("missing Printful placement data");
  const hasPrintFile = placements.some((p) => Boolean(p.fileUrl || p.fileId));
  if (placements.length > 0 && !hasPrintFile) reasons.push("missing print file url/id");

  // Commercial fields
  if (!(variant.retailPrice > 0)) reasons.push("missing retail price");
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
