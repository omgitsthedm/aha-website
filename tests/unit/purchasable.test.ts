import { describe, it, expect } from "vitest";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import type { AhaProduct, AhaVariant } from "@/lib/types/product";

function fullyMappedVariant(overrides: Partial<AhaVariant> = {}): AhaVariant {
  return {
    ahaVariantId: "v1", ahaProductId: "p1", sku: "TEE-BLK-M", size: "M", color: "Black",
    retailPrice: 4800, currency: "USD", status: "active", sortOrder: 0,
    squareCatalogObjectId: "SQ_OBJ", squareVariationId: "SQ_VAR",
    printfulCatalogVariantId: 4011, printfulSource: "catalog",
    printfulRegionAvailability: ["north_america"],
    printfulPlacements: [{ placement: "front", technique: "dtg", fileUrl: "https://x/design.png" }],
    ...overrides,
  };
}

function activeProduct(overrides: Partial<AhaProduct> = {}): AhaProduct {
  return {
    ahaProductId: "p1", slug: "black-tee", title: "Black Tee",
    shortDescription: "s", fullDescription: "f", productType: "tee",
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

  it("blocks when a placement has no print file", () => {
    const v = fullyMappedVariant({ printfulPlacements: [{ placement: "front", technique: "dtg" }] });
    const p = activeProduct({ variants: [v] });
    expect(checkVariantPurchasable(p, v).reasons).toContain("missing print file url/id");
  });
});
