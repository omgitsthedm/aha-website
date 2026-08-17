import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  conflict: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: () => ({ insert: mocks.insert }),
  isDbConfigured: mocks.configured,
}));

import {
  ApliiqProductCallbackUnavailableError,
  parseApliiqAddToStorePayload,
  upsertApliiqProductDraft,
} from "@/lib/apliiq/product-callbacks";

const payload = parseApliiqAddToStorePayload({
  store_ProductId: null,
  shippingProfileId: null,
  type: "pants",
  name: "Midweight Fleece Joggers",
  currency: "USD",
  taxonomyId: null,
  description: null,
  imageUrls: ["https://blob.apliiq.com/sitestorage/product.jpg"],
  replaceProduct: false,
  sizes: ["s", "m"],
  colors: ["Grey Heather"],
  variants: [
    { sku: "APQ-4633445S6A1", price: 63.78, color: "Grey Heather", size: "s", imageUrl: "https://blob.apliiq.com/sitestorage/product.jpg" },
    { sku: "APQ-4633445S7A1", price: 63.78, color: "Grey Heather", size: "m", imageUrl: "https://blob.apliiq.com/sitestorage/product.jpg" },
  ],
});

describe("APLIIQ review-only product draft persistence", () => {
  beforeEach(() => {
    mocks.configured.mockReturnValue(true);
    mocks.conflict.mockResolvedValue(undefined);
    mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.conflict });
    mocks.insert.mockReturnValue({ values: mocks.values });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("persists one pending-review draft per APQ SKU and never a storefront product", async () => {
    const storeProductId = await upsertApliiqProductDraft(payload);

    expect(storeProductId).toMatch(/^review:apliiq:[a-f0-9]{32}$/);
    expect(mocks.values).toHaveBeenCalledTimes(2);
    expect(mocks.values).toHaveBeenNthCalledWith(1, expect.objectContaining({
      provider: "apliiq",
      providerProductId: storeProductId,
      providerVariantId: "APQ-4633445S6A1",
      providerSku: "APQ-4633445S6A1",
      status: "pending_review",
      payloadJson: payload,
    }));
    expect(mocks.conflict).toHaveBeenCalledTimes(2);
  });

  it("fails closed before any write when draft storage is unavailable", async () => {
    mocks.configured.mockReturnValue(false);
    await expect(upsertApliiqProductDraft(payload)).rejects.toBeInstanceOf(ApliiqProductCallbackUnavailableError);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
