import { afterEach, describe, expect, it, vi } from "vitest";

async function loadEnabledPreviewCatalog() {
  vi.resetModules();
  vi.doMock("@/lib/commerce/catalog-policy", async () => {
    const actual = await vi.importActual<typeof import("@/lib/commerce/catalog-policy")>("@/lib/commerce/catalog-policy");
    return {
      ...actual,
      isSellableProvider: (provider: string | undefined) => provider === "apliiq",
    };
  });
  return import("@/lib/data/preview-catalog");
}

afterEach(() => {
  vi.doUnmock("@/lib/commerce/catalog-policy");
  vi.resetModules();
});

describe("preview catalog projection when the authorized catalog is restored", () => {
  it("projects the validated internal product layer", async () => {
    const { buildPreviewProducts } = await loadEnabledPreviewCatalog();
    const products = buildPreviewProducts();

    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.variations.length > 0)).toBe(true);
  });

  it("keeps unique sizes per product for deterministic selection", async () => {
    const { buildPreviewProducts } = await loadEnabledPreviewCatalog();
    for (const product of buildPreviewProducts()) {
      const sizes = product.variations.map((variation) => variation.name.toUpperCase());
      expect(new Set(sizes).size).toBe(sizes.length);
    }
  });

  it("keeps routes and filters free of empty categories", async () => {
    const { buildPreviewCollections, buildPreviewProducts } = await loadEnabledPreviewCatalog();
    const collections = buildPreviewCollections();
    const products = buildPreviewProducts();

    expect(collections.length).toBeGreaterThan(0);
    expect(collections.every((collection) => products.some((product) => product.collectionIds.includes(collection.id)))).toBe(true);
    for (const collection of collections) {
      const stocked = products.filter((product) => product.collectionIds.includes(collection.id) && product.variations.length > 0);
      expect(stocked.length).toBeGreaterThan(0);
    }
  });
});
