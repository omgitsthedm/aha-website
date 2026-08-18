import { afterEach, describe, expect, it, vi } from "vitest";
import type { AhaProduct } from "@/lib/types/product";

const { products } = vi.hoisted(() => ({ products: [] as AhaProduct[] }));
vi.mock("@/lib/data/products", () => ({ loadProducts: () => products }));
import {
  ApliiqProductCallbackValidationError,
  isAuthorizedApliiqProductCallback,
  parseApliiqAddToStorePayload,
  searchApprovedApliiqProducts,
} from "@/lib/apliiq/product-callbacks";

const documentedPayload = {
  store_ProductId: null,
  shippingProfileId: null,
  type: "pants",
  name: "Midweight Fleece Joggers",
  currency: "USD",
  taxonomyId: null,
  description: null,
  imageUrls: [
    "https://blob.apliiq.com/sitestorage/product.jpg",
    "https://blob.apliiq.com/sitestorage/product.jpg",
  ],
  replaceProduct: false,
  sizes: ["s", "m"],
  colors: ["Grey Heather"],
  variants: [
    {
      sku: "APQ-4633445S6A1", price: 63.78, color: "Grey Heather", size: "s",
      imageUrl: "https://blob.apliiq.com/sitestorage/product.jpg", weight: 11.9,
      weightUnit: "oz", default: false, width: 6, height: 2, length: 8, dimensionUnit: "in",
    },
    {
      sku: "APQ-4633445S7A1", price: 63.78, color: "Grey Heather", size: "m",
      imageUrl: "https://blob.apliiq.com/sitestorage/product.jpg", weight: 11.9,
      weightUnit: "oz", default: false, width: 6, height: 2, length: 8, dimensionUnit: "in",
    },
  ],
};

describe("APLIIQ Add to Store callback validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    products.splice(0, products.length);
  });

  it("accepts the documented Add to Store payload and preserves APQ variants", () => {
    const payload = parseApliiqAddToStorePayload(documentedPayload);
    expect(payload.name).toBe("Midweight Fleece Joggers");
    expect(payload.imageUrls).toEqual(["https://blob.apliiq.com/sitestorage/product.jpg"]);
    expect(payload.variants.map((variant) => variant.sku)).toEqual(["APQ-4633445S6A1", "APQ-4633445S7A1"]);
  });

  it.each([
    ["non-APQ SKU", { ...documentedPayload, variants: [{ ...documentedPayload.variants[0], sku: "AHA-TEE-M" }] }],
    ["label-like APQ SKU", { ...documentedPayload, variants: [{ ...documentedPayload.variants[0], sku: "APQ-TEE-M" }] }],
    ["HTTP product image", { ...documentedPayload, imageUrls: ["http://blob.apliiq.com/product.jpg"] }],
    ["HTTP variant image", { ...documentedPayload, variants: [{ ...documentedPayload.variants[0], imageUrl: "http://blob.apliiq.com/product.jpg" }] }],
  ])("fails closed for %s", (_label, payload) => {
    expect(() => parseApliiqAddToStorePayload(payload)).toThrow(ApliiqProductCallbackValidationError);
  });

  it("retains bounded provider metadata that is not part of the example payload", () => {
    const payload = parseApliiqAddToStorePayload({
      ...documentedPayload,
      integrationVersion: "2026-08",
      variants: [{ ...documentedPayload.variants[0], providerColorId: 42 }],
    });
    expect(payload.additionalFields).toEqual({ integrationVersion: "2026-08" });
    expect(payload.variants[0].additionalFields).toEqual({ providerColorId: 42 });
  });

  it("requires the separate callback token with constant-time comparison", () => {
    vi.stubEnv("APLIIQ_PRODUCT_CALLBACK_TOKEN", "callback-only-token");
    const validHeader = new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/upsert", {
      headers: { "x-apliiq-callback-token": "callback-only-token" },
    });
    const validQuery = new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/search?token=callback-only-token");
    const wrong = new Request("https://afterhoursagenda.test/api/integrations/apliiq/products/search?token=not-the-token");
    expect(isAuthorizedApliiqProductCallback(validHeader)).toBe(true);
    expect(isAuthorizedApliiqProductCallback(validQuery)).toBe(true);
    expect(isAuthorizedApliiqProductCallback(wrong)).toBe(false);
  });

  it("returns no legacy products when the committed APLIIQ map is empty", () => {
    expect(searchApprovedApliiqProducts("")).toEqual([]);
  });

  it("omits an otherwise approved search result until it has HTTPS provider assets", () => {
    const product: AhaProduct = {
      ahaProductId: "apliiq-tee", slug: "apliiq-tee", title: "APLIIQ Tee",
      shortDescription: "s", fullDescription: "f", productType: "tee", category: "t-shirts",
      gender: ["unisex"], collectionIds: ["tees"], status: "active", retailPrice: 4800, currency: "USD",
      fitDescription: "true to size", fabricDescription: "cotton", printMethod: "DTG", careInstructions: "cold wash",
      productionNote: "made to order", shippingNote: "ships", returnsNote: "returns", sizeGuideId: "sg-tee",
      featuredImage: "/tee.webp", galleryImages: [], seoTitle: "APLIIQ Tee", seoDescription: "desc", ogImage: "/tee.webp",
      variants: [{
        ahaVariantId: "apliiq-tee-m", ahaProductId: "apliiq-tee", sku: "AHA-TEE-M", size: "M",
        retailPrice: 4800, currency: "USD", status: "active", sortOrder: 0, fulfillmentProvider: "apliiq",
        squareCatalogObjectId: "square-item", squareVariationId: "square-variation", squareMappingStatus: "active",
        apliiqSku: "APQ-1998244S7A1", apliiqDecorationSnapshot: { front: { artworkId: "front" } },
        apliiqPrivateLabelSnapshot: { neck: { artworkId: "neck" } }, apliiqRegionAvailability: ["US"],
        apliiqSizeGuideReference: "sg-tee", apliiqMappingApproval: "approved", apliiqSampleApproval: "approved",
        // Landed margin on 4800 retail: 1500 item + 596 freight (7.9 oz tier)
        // + 100 per-product fee + 12 modelled destination tax + 169 Square fee.
        // The tax term is the blended CA rate (APLIIQ_DESTINATION_TAX_BASIS_POINTS,
        // 76 bp); this literal moves the day that constant does. See margin.ts.
        weightOz: 7.9, costEstimate: 1500, marginEstimate: 2423,
        costVerifiedAt: "2026-08-16T00:00:00.000Z",
        marginVerifiedAt: "2026-08-16T00:00:00.000Z", printfulSource: "catalog",
      }],
    };
    products.push(product);
    expect(searchApprovedApliiqProducts("tee")).toEqual([]);
    product.variants[0].apliiqAssetUrls = ["https://assets.example/tee.jpg"];
    expect(searchApprovedApliiqProducts("tee")).toEqual([{
      store_ProductId: "apliiq-tee", name: "APLIIQ Tee", imageUrls: ["https://assets.example/tee.jpg"],
    }]);
  });
});
