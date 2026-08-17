import { describe, expect, it, vi } from "vitest";
import type { AhaProduct } from "@/lib/types/product";

const { products } = vi.hoisted(() => ({ products: [] as AhaProduct[] }));

vi.mock("@/lib/data/products", () => ({ loadProducts: () => products }));

import {
  assertCartFulfillableToCountry,
  buildOrderItemRecords,
  revalidateCartForFulfillmentRetry,
} from "@/lib/commerce/orders";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import { rebuildFulfillmentCartFromSnapshots } from "@/lib/commerce/fulfillment-snapshot";
import { buildApliiqFulfillmentOrder } from "@/lib/fulfillment/apliiq-adapter";
import { buildApliiqOrderPayload } from "@/lib/apliiq/orders";

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
      apliiqSku: "APQ-1998244S7A1", apliiqProductId: "apq-product", apliiqVariantId: "apq-variant",
      apliiqDecorationSnapshot: { front: { art: "art-1" } }, apliiqRegionAvailability: ["US"],
      apliiqPrivateLabelSnapshot: { neckLabel: { art: "label-1" } },
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

    expect(checkVariantPurchasable(product, product.variants[0]).reasons)
      .toContain("APLIIQ sample is not approved");
  });

  it("preserves an approved APLIIQ provider snapshot for order persistence", () => {
    products.splice(0, products.length, approvedApliiqProduct());

    const cart = revalidateCartForFulfillmentRetry([{ squareVariationId: "square-variation", quantity: 2 }]);
    expect(cart.items[0]).toMatchObject({
      fulfillmentProvider: "apliiq", providerVariantId: "apq-variant", providerSku: "APQ-1998244S7A1",
    });
    expect(cart.items[0].providerSnapshot).toMatchObject({
      apliiqSku: "APQ-1998244S7A1",
      mappingApproval: "approved",
      sampleApproval: "approved",
    });
  });

  it("carries the paid snapshot through persistence, retry reconstruction, and APLIIQ submission", () => {
    products.splice(0, products.length, approvedApliiqProduct());
    const purchaseCart = revalidateCartForFulfillmentRetry([
      { squareVariationId: "square-variation", quantity: 2 },
    ]);
    const [persisted] = buildOrderItemRecords(42, purchaseCart.items);
    const retryCart = rebuildFulfillmentCartFromSnapshots([persisted], "USD", purchaseCart.subtotal);
    const payload = buildApliiqOrderPayload(buildApliiqFulfillmentOrder({
      orderId: 42,
      externalOrderNumber: "AHA-ORDER-42",
      providerRequestId: "aha-apliiq-42",
      contact: {
        email: "customer@example.com",
        shippingName: "Taylor Customer",
        shippingAddress: {
          address1: "1 Main Street", city: "New York", state: "NY", country: "US", zip: "10001",
        },
      },
      items: retryCart.items,
    }));

    expect(payload).toMatchObject({
      id: "aha-apliiq-42",
      line_items: [{ quantity: 2, sku: "APQ-1998244S7A1" }],
      shipping_address: { country_code: "US", province_code: "NY" },
    });
  });

  it("rejects a destination outside the immutable APLIIQ region list before payment", () => {
    products.splice(0, products.length, approvedApliiqProduct());
    const cart = revalidateCartForFulfillmentRetry([
      { squareVariationId: "square-variation", quantity: 1 },
    ]);
    expect(() => assertCartFulfillableToCountry(cart, "US")).not.toThrow();
    expect(() => assertCartFulfillableToCountry(cart, "CA"))
      .toThrow('"APQ Tee" is not available for shipping to CA.');
  });
});
