// Single source of truth for "can this variant be sold?" — used by both the build-time
// validation scripts (scripts/validate-*.ts) and runtime PDP add-to-cart gating (§13/§18).
// If this returns reasons, the variant is NOT purchasable and add-to-cart must be disabled.

import type { AhaProduct, AhaVariant } from "@/lib/types/product";
import { isApliiqSku } from "@/lib/apliiq/orders";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";
import { calculateLandedContributionMargin, LEGACY_PRINTFUL_MARGIN_TERMS } from "@/lib/commerce/margin";

export interface ReadinessResult {
  ok: boolean;
  reasons: string[];
}

const MIN_PRODUCT_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35");
const MIN_MARGIN_PERCENT = Math.round(MIN_PRODUCT_MARGIN_RATIO * 100);

/** Full purchasable check for a variant in the context of its product. */
export function checkVariantPurchasable(
  product: AhaProduct,
  variant: AhaVariant
): ReadinessResult {
  const reasons: string[] = [];
  // Keep direct callers and legacy fixtures compatible with the loader's
  // documented default while product data transitions to explicit providers.
  const fulfillmentProvider = variant.fulfillmentProvider ?? "printful";

  if (product.status !== "active") reasons.push("product not active");
  if (variant.status !== "active") reasons.push("variant not active");

  // Square mapping
  if (!variant.squareCatalogObjectId) reasons.push("missing Square catalog object id");
  if (!variant.squareVariationId) reasons.push("missing Square variation id");

  if (fulfillmentProvider === "apliiq" && variant.squareMappingStatus !== "active") {
    reasons.push("Square mapping is not active");
  }

  if (fulfillmentProvider === "apliiq") {
    // APLIIQ cannot reuse Printful's catalog/sync-variant assumptions. These
    // gates make its source mapping and human approvals explicit before a
    // checkout route is allowed to charge for the line.
    if (!variant.apliiqSku) reasons.push("missing APLIIQ SKU");
    else if (!isApliiqSku(variant.apliiqSku)) reasons.push("invalid APLIIQ APQ SKU");
    if (!variant.apliiqDecorationSnapshot || Object.keys(variant.apliiqDecorationSnapshot).length === 0) {
      reasons.push("missing APLIIQ decoration snapshot");
    }
    if (!variant.apliiqPrivateLabelSnapshot || Object.keys(variant.apliiqPrivateLabelSnapshot).length === 0) {
      reasons.push("missing APLIIQ private-label snapshot");
    }
    if (variant.costEstimate == null || !variant.costVerifiedAt) {
      reasons.push("missing verified APLIIQ fulfillment cost");
    }
    if (variant.marginEstimate == null || !variant.marginVerifiedAt) {
      reasons.push("missing verified APLIIQ margin");
    } else {
      // The old gate required marginEstimate === retailPrice - costEstimate,
      // which meant an operator who entered the TRUE landed margin was rejected
      // and only the fiction that ignores freight, the per-product fulfillment
      // fee, payment fees and destination tax could pass. Reconcile against the
      // landed figure instead.
      const landed = resolveApliiqLandedCost(variant);
      if (!landed.ok) {
        reasons.push(...landed.reasons);
      } else if (variant.marginEstimate !== landed.landed.margin.contributionMargin) {
        reasons.push(`APLIIQ margin does not match landed cost (expected ${landed.landed.margin.contributionMargin})`);
      } else {
        // A variant may carry a reasoned, per-variant exception. The global floor
        // is never lowered to admit one product — see marginFloorOverride on
        // AhaVariant. The exception can permit a thin margin, never a loss.
        const override = variant.marginFloorOverride;
        const floor = override ? Math.max(0, override.minRatio) : MIN_PRODUCT_MARGIN_RATIO;
        const ratio = landed.landed.margin.contributionMarginRatio;
        // Diagnose a loss as a loss. Checked BEFORE the floor because
        // "margin -78.0% below the 0% override floor" sends an operator hunting
        // for a threshold when the actual problem is that the garment costs
        // more than it sells for. An override permits a thin margin; nothing
        // permits selling below cost.
        if (landed.landed.margin.contributionMargin <= 0) {
          reasons.push("landed cost exceeds retail price");
        } else if (ratio < floor) {
          reasons.push(override
            ? `landed-cost margin ${(ratio * 100).toFixed(1)}% below the ${(floor * 100).toFixed(0)}% override floor (${override.reason})`
            : `landed-cost margin below ${MIN_MARGIN_PERCENT}% floor`);
        }
      }
    }
    if ((variant.apliiqRegionAvailability?.length ?? 0) === 0) reasons.push("missing APLIIQ region availability");
    else if (variant.apliiqRegionAvailability!.some((entry) => !/^[A-Z]{2}$/.test(entry))) {
      reasons.push("invalid APLIIQ region availability");
    }
    if (!variant.apliiqSizeGuideReference) reasons.push("missing APLIIQ size-guide reference");
    if (variant.apliiqMappingApproval !== "approved") reasons.push("APLIIQ mapping is not approved");
    if (variant.apliiqSampleApproval !== "approved") reasons.push("APLIIQ sample is not approved");
  } else if (fulfillmentProvider === "printful") {

    // Printful v2 mapping. Fulfillment uses the store sync-variant (art configured server-side);
    // a catalog file url/id is only required when there is no sync variant.
    if (!variant.printfulCatalogVariantId) reasons.push("missing Printful v2 catalog variant id");
    const placements = variant.printfulPlacements ?? [];
    if (placements.length === 0) reasons.push("missing Printful placement data");
    const hasArt =
      Boolean(variant.printfulSyncVariantId) || placements.some((p) => Boolean(p.fileUrl || p.fileId));
    if (!hasArt) reasons.push("missing print art (sync variant or file)");
    if ((variant.printfulRegionAvailability?.length ?? 0) === 0) reasons.push("missing region availability");
  } else {
    reasons.push("unsupported fulfillment provider");
  }

  // Commercial fields
  if (!(variant.retailPrice > 0)) reasons.push("missing retail price");
  const costEstimate = variant.costEstimate;
  if (fulfillmentProvider !== "apliiq" && costEstimate == null) {
    reasons.push("missing verified fulfillment cost");
  } else if (fulfillmentProvider !== "apliiq" && costEstimate != null) {
    // Legacy Printful routes through the same shared calculation, with the
    // freight/fee/tax/payment terms explicitly zeroed. See
    // LEGACY_PRINTFUL_MARGIN_TERMS: that is a named, documented gap awaiting a
    // verified Printful rate table, not a claim that Printful freight is free.
    const legacy = calculateLandedContributionMargin({
      retailPrice: variant.retailPrice,
      providerItemCost: costEstimate,
      ...LEGACY_PRINTFUL_MARGIN_TERMS,
    });
    if (legacy.contributionMarginRatio < MIN_PRODUCT_MARGIN_RATIO) {
      reasons.push(`product-cost margin below ${MIN_MARGIN_PERCENT}% floor`);
    }
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

  return { ok: reasons.length === 0, reasons };
}

/** Convenience: is at least one variant purchasable for this product? */
export function productHasPurchasableVariant(product: AhaProduct): boolean {
  return product.variants.some((v) => checkVariantPurchasable(product, v).ok);
}
