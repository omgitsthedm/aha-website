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

    // Was a hardcoded 4. buildPreviewCollections now hides a category with
    // nothing sellable in it — with the capsule live that drops "Sweaters &
    // Knitwear" and "Accessories", which would otherwise render as empty
    // category pages on a live store. The invariant worth pinning is the second
    // line, which was already here: every surfaced collection has stock.
    expect(collections.length).toBeGreaterThan(0);
    expect(collections.every((collection) => products.some((product) => product.collectionIds.includes(collection.id)))).toBe(true);
    // ...and the converse, which is the new behaviour: no empty category ships.
    for (const collection of collections) {
      const stocked = products.filter((p) => p.collectionIds.includes(collection.id) && p.variations.length > 0);
      expect(stocked.length).toBeGreaterThan(0);
    }
  });
});
