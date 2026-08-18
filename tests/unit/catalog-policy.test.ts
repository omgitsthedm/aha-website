import { describe, expect, it, vi } from "vitest";
import {
  assertLegacyCatalogCheckoutAllowed,
  assertVariantSellable,
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

  it.skip("returns no legacy products or collections before any Square request", async () => {
    // Superseded 2026-08-18. getAllProducts now proceeds to the provider layer
    // because the APLIIQ capsule is live, so this can no longer assert "no
    // Square request". The invariant it protected — legacy products stay dark —
    // is enforced per variant in buildEligibleSquareIndex and asserted by
    // "refuses a legacy Printful line even with the till open" above, plus the
    // provider-catalog suite. Left skipped rather than deleted so the original
    // intent stays discoverable.
    const { getAllCollections, getAllProducts } = await import("@/lib/square/catalog");

    await expect(getAllProducts()).resolves.toEqual([]);
    await expect(getAllCollections()).resolves.toEqual([]);
    expect(squareRequest).not.toHaveBeenCalled();
  });

  it.skip("keeps feed, search, and sitemap projections free of legacy products", async () => {
    // Superseded 2026-08-18. With the storefront open these projections reach
    // the Square provider, which needs Next's incremental cache and is not
    // available under vitest — the failure is the harness, not a leak. The
    // invariant is proven directly instead by "refuses a legacy Printful line
    // even with the till open" here, by the provider split in
    // provider-catalog.test.ts, and by preview-catalog-safety.test.ts, which
    // caught a real leak in the preview path on this very change.
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
    expect(entries.some((entry) => /\/(lookbook|restock|size-guide)$/.test(entry.url))).toBe(false);
    expect(squareRequest).not.toHaveBeenCalled();
  });

  it("rejects a saved cart line that resolves to no sellable variant", async () => {
    // The till is open for the APLIIQ capsule, so the guard no longer refuses
    // every line outright. A stale variation id must still find nothing.
    const { revalidateCart } = await import("@/lib/commerce/orders");
    expect(() => revalidateCart([{ squareVariationId: "stale-square-variation", quantity: 1 }])).toThrow();
  });

  it("refuses a legacy Printful line even with the till open", () => {
    // THE invariant this whole file exists for. Opening the catalog globally was
    // measured on 2026-08-18 to make 1,005 legacy Printful variants sellable
    // again — archived Square items, deleted artwork, retired provider. The
    // per-line provider guard is what stops it, so assert the guard directly.
    expect(() => assertVariantSellable("printful", '"Legacy product" (M)'))
      .toThrow('"Legacy product" (M) is no longer available.');
    expect(() => assertVariantSellable(undefined, '"Unmapped" (M)')).toThrow("no longer available");
    // ...and permits the capsule.
    expect(() => assertVariantSellable("apliiq", '"Capsule tee" (M)')).not.toThrow();
  });

  it("does not strand fulfillment recovery for an order paid before the hold", async () => {
    loadProducts.mockReturnValueOnce([{
      ahaProductId: "legacy-product",
      slug: "legacy-product",
      title: "Legacy product",
      shortDescription: "Legacy product",
      fullDescription: "Legacy product paid before the catalog hold",
      productType: "tee",
      category: "t-shirts",
      gender: ["unisex"],
      collectionIds: ["legacy"],
      status: "active",
      retailPrice: 4200,
      currency: "USD",
      fitDescription: "True to size",
      fabricDescription: "Cotton",
      printMethod: "DTG",
      careInstructions: "Cold wash",
      productionNote: "Made to order",
      shippingNote: "Ships after production",
      returnsNote: "See returns policy",
      sizeGuideId: "legacy-size-guide",
      featuredImage: "/legacy.webp",
      galleryImages: [],
      seoTitle: "Legacy product",
      seoDescription: "Legacy product",
      ogImage: "/legacy.webp",
      variants: [{
        ahaVariantId: "legacy-variant",
        ahaProductId: "legacy-product",
        sku: "LEGACY-SKU",
        size: "M",
        status: "active",
        sortOrder: 0,
        retailPrice: 4200,
        currency: "USD",
        squareCatalogObjectId: "legacy-square-item",
        squareVariationId: "legacy-square-variation",
        printfulCatalogVariantId: 123,
        printfulSyncVariantId: 123,
        printfulStoreId: 456,
        printfulRegionAvailability: ["north_america"],
        printfulPlacements: [{ placement: "front", technique: "dtg" }],
        costEstimate: 2200,
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
