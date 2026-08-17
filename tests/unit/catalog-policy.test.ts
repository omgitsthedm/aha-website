import { describe, expect, it, vi } from "vitest";
import {
  assertLegacyCatalogCheckoutAllowed,
  isLegacyCatalogPublic,
} from "@/lib/commerce/catalog-policy";
import { catalogMigrationMetadata } from "@/components/shop/CatalogMigrationPage";

const { loadProducts, squareRequest } = vi.hoisted(() => ({ loadProducts: vi.fn(), squareRequest: vi.fn() }));
vi.mock("@/lib/data/products", () => ({
  loadProducts,
  loadProductMap: vi.fn(() => new Map()),
}));
vi.mock("@/lib/square/client", () => ({ squareRequest }));

describe("legacy catalog migration hold", () => {
  it("keeps the legacy catalog off every public projection", () => {
    expect(isLegacyCatalogPublic()).toBe(false);
  });

  it("returns no legacy products or collections before any Square request", async () => {
    const { getAllCollections, getAllProducts } = await import("@/lib/square/catalog");

    await expect(getAllProducts()).resolves.toEqual([]);
    await expect(getAllCollections()).resolves.toEqual([]);
    expect(squareRequest).not.toHaveBeenCalled();
  });

  it("keeps feed, search, and sitemap projections free of legacy products", async () => {
    const [
      { GET: productFeed },
      { GET: searchIndex },
      { default: sitemap },
    ] = await Promise.all([
      import("@/app/product-feed.xml/route"),
      import("@/app/api/search-index/route"),
      import("@/app/sitemap"),
    ]);

    const [feed, search, entries] = await Promise.all([productFeed(), searchIndex(), sitemap()]);
    expect(await feed.text()).not.toContain("<g:item");
    await expect(search.json()).resolves.toEqual([]);
    expect(entries.some((entry) => entry.url.includes("/product/"))).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith("/shop"))).toBe(false);
    expect(squareRequest).not.toHaveBeenCalled();
  });

  it("rejects saved Square cart lines before loading legacy mappings", async () => {
    const { revalidateCart } = await import("@/lib/commerce/orders");

    expect(() => revalidateCart([{ squareVariationId: "stale-square-variation", quantity: 1 }]))
      .toThrow("The store is being updated. Existing items cannot be purchased right now.");
    expect(loadProducts).not.toHaveBeenCalled();
  });

  it("keeps the checkout guard fail-closed", () => {
    expect(() => assertLegacyCatalogCheckoutAllowed())
      .toThrow("The store is being updated. Existing items cannot be purchased right now.");
  });

  it("does not strand fulfillment recovery for an order paid before the hold", async () => {
    loadProducts.mockReturnValueOnce([{
      ahaProductId: "legacy-product",
      title: "Legacy product",
      status: "active",
      variants: [{
        ahaVariantId: "legacy-variant",
        sku: "LEGACY-SKU",
        size: "M",
        status: "active",
        retailPrice: 4200,
        currency: "USD",
        squareVariationId: "legacy-square-variation",
        printfulSyncVariantId: 123,
        printfulStoreId: 456,
      }],
    }]);
    const { revalidateCartForFulfillmentRetry } = await import("@/lib/commerce/orders");

    expect(revalidateCartForFulfillmentRetry([
      { squareVariationId: "legacy-square-variation", quantity: 1 },
    ])).toMatchObject({ subtotal: 4200, items: [{ printfulSyncVariantId: 123 }] });
  });

  it("marks retired catalog route metadata as noindex", () => {
    const metadata = catalogMigrationMetadata("/shop");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("/shop");
  });
});
