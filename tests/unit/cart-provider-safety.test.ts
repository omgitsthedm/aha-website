import { describe, expect, it, vi } from "vitest";
import type { AhaProduct } from "@/lib/types/product";

const { products } = vi.hoisted(() => ({ products: [] as AhaProduct[] }));

vi.mock("@/lib/data/products", () => ({ loadProducts: () => products }));

import { revalidateCart } from "@/lib/commerce/orders";

function approvedApliiqProduct(): AhaProduct {
  return {
    ahaProductId: "apliiq-tee", slug: "apliiq-tee", title: "APQ Tee",
    shortDescription: "s", fullDescription: "f", productType: "tee", category: "t-shirts",
    gender: ["unisex"], collectionIds: ["tees"], status: "active", retailPrice: 4800, currency: "USD",
    fitDescription: "true to size", fabricDescription: "cotton", printMethod: "DTG", careInstructions: "cold wash",
    productionNote: "made to order", shippingNote: "ships", returnsNote: "returns", sizeGuideId: "sg-tee",
    featuredImage: "/tee.webp", galleryImages: [], seoTitle: "APQ Tee", seoDescription: "desc", ogImage: "/tee.webp",
    variants: [{
      ahaVariantId: "apliiq-tee-m", ahaProductId: "apliiq-tee", sku: "AHA-TEE-M", size: "M",
      retailPrice: 4800, currency: "USD", status: "active", sortOrder: 0, fulfillmentProvider: "apliiq",
      squareCatalogObjectId: "square-item", squareVariationId: "square-variation", squareMappingStatus: "active",
      apliiqSku: "APQ-TEE-M", apliiqProductId: "apq-product", apliiqVariantId: "apq-variant",
      apliiqDecorationSnapshot: { front: { art: "art-1" } }, apliiqRegionAvailability: ["US"],
      apliiqSizeGuideReference: "sg-tee", apliiqMappingApproval: "approved", apliiqSampleApproval: "approved",
      costEstimate: 2500, marginEstimate: 2300,
      costVerifiedAt: "2026-08-16T00:00:00.000Z", marginVerifiedAt: "2026-08-16T00:00:00.000Z",
      printfulSource: "catalog",
    }],
  };
}

describe("server cart provider safety", () => {
  it("refuses an APLIIQ line that loses structural approval before payment", () => {
    const product = approvedApliiqProduct();
    product.variants[0].apliiqSampleApproval = "pending";
    products.splice(0, products.length, product);

    expect(() => revalidateCart([{ squareVariationId: "square-variation", quantity: 1 }]))
      .toThrow("APLIIQ sample is not approved");
  });

  it("preserves an approved APLIIQ provider snapshot for order persistence", () => {
    products.splice(0, products.length, approvedApliiqProduct());

    const cart = revalidateCart([{ squareVariationId: "square-variation", quantity: 2 }]);
    expect(cart.items[0]).toMatchObject({
      fulfillmentProvider: "apliiq", providerVariantId: "apq-variant", providerSku: "APQ-TEE-M",
    });
    expect(cart.items[0].providerSnapshot).toMatchObject({ apliiqSku: "APQ-TEE-M" });
  });
});
