import { describe, it, expect } from "vitest";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import { modelDestinationTaxCents } from "@/lib/commerce/margin";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";
import type { AhaProduct, AhaVariant } from "@/lib/types/product";

function fullyMappedVariant(overrides: Partial<AhaVariant> = {}): AhaVariant {
  return {
    ahaVariantId: "v1", ahaProductId: "p1", sku: "TEE-BLK-M", size: "M", color: "Black",
    retailPrice: 4800, currency: "USD", status: "active", sortOrder: 0,
    squareCatalogObjectId: "SQ_OBJ", squareVariationId: "SQ_VAR",
    printfulCatalogVariantId: 4011, printfulSource: "catalog",
    costEstimate: 2500,
    printfulRegionAvailability: ["north_america"],
    printfulPlacements: [{ placement: "front", technique: "dtg", fileUrl: "https://x/design.png" }],
    ...overrides,
  };
}

function activeProduct(overrides: Partial<AhaProduct> = {}): AhaProduct {
  return {
    ahaProductId: "p1", slug: "black-tee", title: "Black Tee",
    shortDescription: "s", fullDescription: "f", productType: "tee",
    category: "t-shirts", gender: ["men", "women", "unisex"],
    collectionIds: ["tees"], status: "active", retailPrice: 4800, currency: "USD",
    fitDescription: "true to size", fabricDescription: "100% cotton", printMethod: "DTG",
    careInstructions: "cold wash", productionNote: "made to order", shippingNote: "free shipping",
    returnsNote: "30 days", sizeGuideId: "sg-tee", featuredImage: "/img.webp", galleryImages: [],
    seoTitle: "Black Tee", seoDescription: "desc", ogImage: "/og.png", variants: [],
    ...overrides,
  };
}

describe("checkVariantPurchasable", () => {
  it("passes when product active + variant fully mapped", () => {
    const v = fullyMappedVariant();
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v)).toEqual({ ok: true, reasons: [] });
  });

  it("blocks when Printful mapping is missing", () => {
    const v = fullyMappedVariant({ printfulCatalogVariantId: undefined, printfulPlacements: [] });
    const p = activeProduct({ variants: [v] });
    const res = checkVariantPurchasable(p, v);
    expect(res.ok).toBe(false);
    expect(res.reasons).toContain("missing Printful v2 catalog variant id");
    expect(res.reasons).toContain("missing Printful placement data");
  });

  it("blocks when the product is not active", () => {
    const v = fullyMappedVariant();
    const p = activeProduct({ status: "coming_soon", variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain("product not active");
  });

  it("blocks when there is no print art (no sync variant and no file)", () => {
    const v = fullyMappedVariant({ printfulSyncVariantId: undefined, printfulPlacements: [{ placement: "front", technique: "dtg" }] });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain("missing print art (sync variant or file)");
  });

  it("passes fulfillment via sync variant even when placement files are empty", () => {
    const v = fullyMappedVariant({ printfulSyncVariantId: 4616188601, printfulPlacements: [{ placement: "front", technique: "dtg" }] });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v)).toEqual({ ok: true, reasons: [] });
  });

  it("blocks sale without a verified fulfillment cost", () => {
    const v = fullyMappedVariant({ costEstimate: undefined });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain("missing verified fulfillment cost");
  });

  it("blocks sale below the product-cost margin floor", () => {
    const v = fullyMappedVariant({ retailPrice: 4000, costEstimate: 2800 });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain("product-cost margin below 35% floor");
  });

  it("requires APLIIQ mapping, approved sample, and an active Square mapping", () => {
    const v = fullyMappedVariant({
      fulfillmentProvider: "apliiq",
      printfulCatalogVariantId: undefined,
      printfulPlacements: undefined,
      costVerifiedAt: undefined,
      marginEstimate: undefined,
      marginVerifiedAt: undefined,
    });
    const p = activeProduct({ variants: [v] });
    const result = checkVariantPurchasable(p, v);
    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      "Square mapping is not active",
      "missing APLIIQ SKU",
      "missing APLIIQ decoration snapshot",
      "missing APLIIQ private-label snapshot",
      "missing verified APLIIQ fulfillment cost",
      "missing verified APLIIQ margin",
      "missing APLIIQ region availability",
      "missing APLIIQ size-guide reference",
      "APLIIQ mapping is not approved",
      "APLIIQ sample is not approved",
    ]));
  });

  // retail 4800, item 1500, 7.9 oz freight 596, $1.00 per-product fee,
  // modelled destination tax on (1500 + 100), Square 2.9% + 30c.
  const LANDED_TAX = modelDestinationTaxCents(1600);
  const LANDED_MARGIN = 4800 - (Math.round(4800 * 0.029) + 30) - (1500 + 596 + 100 + LANDED_TAX);

  function approvedApliiqVariant(overrides: Partial<AhaVariant> = {}): AhaVariant {
    return fullyMappedVariant({
      fulfillmentProvider: "apliiq",
      printfulCatalogVariantId: undefined,
      printfulPlacements: undefined,
      apliiqSku: "APQ-1998244S7A1",
      apliiqProductId: "apq-product-1",
      apliiqVariantId: "apq-variant-1",
      apliiqDecorationSnapshot: { front: { artworkId: "art-1" } },
      apliiqPrivateLabelSnapshot: { neckLabel: { artworkId: "label-1" } },
      apliiqRegionAvailability: ["US"],
      apliiqSizeGuideReference: "sg-tee",
      apliiqMappingApproval: "approved",
      apliiqSampleApproval: "approved",
      squareMappingStatus: "active",
      weightOz: 7.9,
      costEstimate: 1500,
      costVerifiedAt: "2026-08-16T00:00:00.000Z",
      marginEstimate: LANDED_MARGIN,
      marginVerifiedAt: "2026-08-16T00:00:00.000Z",
      ...overrides,
    });
  }

  it("passes a structurally approved APLIIQ variant without Printful fields", () => {
    const v = approvedApliiqVariant();
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v)).toEqual({ ok: true, reasons: [] });
  });

  it("blocks an APLIIQ margin snapshot that does not reconcile to landed cost", () => {
    const v = approvedApliiqVariant({ marginEstimate: LANDED_MARGIN + 1 });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain(
      `APLIIQ margin does not match landed cost (expected ${LANDED_MARGIN})`
    );
  });

  // The regression this engine exists to stop: the old gate demanded
  // marginEstimate === retailPrice - costEstimate, so the ONLY value it accepted
  // was the one that ignores freight, the per-product fee, payment fees and tax.
  it("rejects the old retail-minus-cost margin and accepts the true landed margin", () => {
    const p = activeProduct();
    const productCostOnly = approvedApliiqVariant({ marginEstimate: 4800 - 1500 });
    expect(checkVariantPurchasable(p, productCostOnly).reasons).toContain(
      `APLIIQ margin does not match landed cost (expected ${LANDED_MARGIN})`
    );
    expect(LANDED_MARGIN).toBeLessThan(4800 - 1500);
    expect(checkVariantPurchasable(p, approvedApliiqVariant())).toEqual({ ok: true, reasons: [] });
  });

  it("blocks an APLIIQ variant whose landed margin is below the floor even though product cost clears it", () => {
    // retail 3400 / item 2125 is 37.5% on product cost and 13.2% landed.
    const productCostRatio = (3400 - 2125) / 3400;
    expect(productCostRatio).toBeGreaterThan(0.35);
    const v = approvedApliiqVariant({
      retailPrice: 3400,
      costEstimate: 2125,
      apliiqDestinationTaxCents: 0,
      marginEstimate: 450,
    });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toEqual(["landed-cost margin below 35% floor"]);
  });

  it("blocks an APLIIQ variant with no shipped weight, because freight cannot be priced", () => {
    const v = approvedApliiqVariant({ weightOz: undefined });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain("missing APLIIQ shipped weight (weightOz)");
  });

  it("blocks an APLIIQ variant too heavy for the published rate ladder", () => {
    const v = approvedApliiqVariant({ weightOz: 600 });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons.join(" ")).toContain("no shipping rate above 479.84 oz");
  });
});

describe("marginFloorOverride — a knowing, per-variant exception", () => {
  // David's call: IND4000 hoodie stays at $60. Item $36.94 + $2.50 private
  // label, 16 oz. That lands at ~9.5% — under the 35% floor, but $5.72 profit
  // a unit, so it is thin rather than a loss.
  function hoodie(overrides: Partial<AhaVariant> = {}): AhaVariant {
    return fullyMappedVariant({
      fulfillmentProvider: "apliiq",
      retailPrice: 6000,
      costEstimate: 3944,
      apliiqItemCost: 3944,
      weightOz: 16,
      apliiqSku: "APQ-1998244S7A1",
      apliiqDecorationSnapshot: { front: { art: "a" } },
      apliiqPrivateLabelSnapshot: { neckLabel: { art: "l" } },
      apliiqRegionAvailability: ["US"],
      apliiqSizeGuideReference: "sg-hoodie",
      apliiqMappingApproval: "approved",
      apliiqSampleApproval: "approved",
      squareMappingStatus: "active",
      costVerifiedAt: "2026-08-18T00:00:00.000Z",
      marginVerifiedAt: "2026-08-18T00:00:00.000Z",
      ...overrides,
    });
  }
  const product = activeProduct({ productType: "hoodie", retailPrice: 6000 });

  function marginOf(v: AhaVariant): number {
    const landed = resolveApliiqLandedCost(v);
    if (!landed.ok) throw new Error(landed.reasons.join("; "));
    return landed.landed.margin.contributionMargin;
  }

  it("refuses the sub-floor margin when no override is present", () => {
    const v = hoodie();
    const reasons = checkVariantPurchasable(product, { ...v, marginEstimate: marginOf(v) }).reasons;
    expect(reasons.some((r) => r.includes("below") && r.includes("floor"))).toBe(true);
  });

  it("admits it when the override names a floor and a reason", () => {
    const v = hoodie({
      marginFloorOverride: { minRatio: 0.09, reason: "anchor hoodie, merchant-approved 2026-08-18", approvedAt: "2026-08-18" },
    });
    const res = checkVariantPurchasable(product, { ...v, marginEstimate: marginOf(v) });
    expect(res.reasons.filter((r) => r.includes("floor"))).toEqual([]);
  });

  it("still refuses when the override floor is set above the real margin", () => {
    const v = hoodie({
      marginFloorOverride: { minRatio: 0.25, reason: "too optimistic", approvedAt: "2026-08-18" },
    });
    const reasons = checkVariantPurchasable(product, { ...v, marginEstimate: marginOf(v) }).reasons;
    // The message must name the override, so nobody hunts for a global floor
    // that was never the thing rejecting it.
    expect(reasons.some((r) => r.includes("override floor") && r.includes("too optimistic"))).toBe(true);
  });

  it("permits a thin margin but never a loss, even at a zero floor", () => {
    // Retail below landed cost: a 0 floor must not read as permission to sell
    // at a loss.
    const v = hoodie({
      retailPrice: 3000,
      marginFloorOverride: { minRatio: 0, reason: "loss leader", approvedAt: "2026-08-18" },
    });
    const reasons = checkVariantPurchasable(product, { ...v, marginEstimate: marginOf(v) }).reasons;
    expect(reasons).toContain("landed cost exceeds retail price");
  });
});
