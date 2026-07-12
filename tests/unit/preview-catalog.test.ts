import { describe, expect, it } from "vitest";
import { buildPreviewCollections, buildPreviewProducts } from "@/lib/data/preview-catalog";

describe("preview catalog fallback", () => {
  it("projects the validated internal product layer for deploy previews", () => {
    const products = buildPreviewProducts();

    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.variations.length > 0)).toBe(true);
  });

  it("keeps unique sizes per product for deterministic preview selection", () => {
    for (const product of buildPreviewProducts()) {
      const sizes = product.variations.map((variation) => variation.name.toUpperCase());
      expect(new Set(sizes).size).toBe(sizes.length);
    }
  });

  it("keeps preview collection routes and filters discoverable", () => {
    const collections = buildPreviewCollections();
    const products = buildPreviewProducts();

    expect(collections.length).toBe(4);
    expect(collections.every((collection) => products.some((product) => product.collectionIds.includes(collection.id)))).toBe(true);
  });
});
