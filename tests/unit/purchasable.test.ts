import { describe, it, expect } from "vitest";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
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

  it("passes a structurally approved APLIIQ variant without Printful fields", () => {
    const v = fullyMappedVariant({
      fulfillmentProvider: "apliiq",
      printfulCatalogVariantId: undefined,
      printfulPlacements: undefined,
      apliiqSku: "APQ-TEE-BLK-M",
      apliiqProductId: "apq-product-1",
      apliiqVariantId: "apq-variant-1",
      apliiqDecorationSnapshot: { front: { artworkId: "art-1" } },
      apliiqPrivateLabelSnapshot: { neckLabel: { artworkId: "label-1" } },
      apliiqRegionAvailability: ["US"],
      apliiqSizeGuideReference: "sg-tee",
      apliiqMappingApproval: "approved",
      apliiqSampleApproval: "approved",
      squareMappingStatus: "active",
      costEstimate: 2500,
      costVerifiedAt: "2026-08-16T00:00:00.000Z",
      marginEstimate: 2300,
      marginVerifiedAt: "2026-08-16T00:00:00.000Z",
    });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v)).toEqual({ ok: true, reasons: [] });
  });

  it("blocks an APLIIQ margin snapshot that does not reconcile to retail minus cost", () => {
    const v = fullyMappedVariant({
      fulfillmentProvider: "apliiq",
      apliiqSku: "APQ-TEE-BLK-M",
      apliiqDecorationSnapshot: { front: { artworkId: "art-1" } },
      apliiqPrivateLabelSnapshot: { neckLabel: { artworkId: "label-1" } },
      apliiqRegionAvailability: ["US"], apliiqSizeGuideReference: "sg-tee",
      apliiqMappingApproval: "approved", apliiqSampleApproval: "approved", squareMappingStatus: "active",
      costEstimate: 2500, costVerifiedAt: "2026-08-16T00:00:00.000Z",
      marginEstimate: 2200, marginVerifiedAt: "2026-08-16T00:00:00.000Z",
    });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain("APLIIQ margin does not match retail minus cost");
  });
});
