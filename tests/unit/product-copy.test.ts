import { describe, expect, it } from "vitest";
import { buildProductStory } from "@/lib/content/product-copy";
import type { Product } from "@/lib/utils/types";

const product = (name: string): Product => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  description: "This t-shirt is comfortable, soft, lightweight, and form-fitting.",
  price: 4000,
  priceFormatted: "$40.00",
  currency: "USD",
  images: [],
  collectionIds: [],
  collectionNames: [],
  variations: [],
});

describe("buildProductStory", () => {
  it("replaces generic provider copy with specific brand context", () => {
    const story = buildProductStory(product("Be You"), null);

    expect(story).toContain("Optimism with its eyes open");
    expect(story).toContain("Be You is printed to order");
    expect(story).not.toContain("comfortable, soft, lightweight");
  });

  // H9: the close used to promise unqualified "free shipping" on every generated
  // PDP story — and that string also fed the Product JSON-LD description across
  // ~92 pages, while the store charges $20 flat to CA/GB/AU. The close now points
  // at the live rates instead of asserting a price.
  it("never claims free shipping in generated copy", () => {
    for (const name of ["Be You", "Cities", "Hot Air"]) {
      expect(buildProductStory(product(name)).toLowerCase()).not.toContain("free shipping");
    }
  });

  // M25: `collection` was a third parameter that only this test ever passed —
  // both production callers passed two, which is how the branch stayed dead.
  // buildProductStory now takes (product, enrichment?) only.
  it("takes no collection argument", () => {
    expect(buildProductStory.length).toBeLessThanOrEqual(2);
  });

  it("produces distinct copy for distinct products", () => {
    expect(buildProductStory(product("Be You"))).not.toBe(
      buildProductStory(product("Cities")),
    );
  });

  it("uses relevant, non-fabricated language for recurring product themes", () => {
    expect(buildProductStory(product("No Kings Tee"))).toContain("self-rule");
    expect(buildProductStory(product("Library Tote Bag"))).toContain("reader's graphic");
    expect(buildProductStory(product("Club TechNoir"))).toContain("sound, style");
  });

  it("does not manufacture scarcity, reviews, or unsupported material claims", () => {
    const story = buildProductStory(product("Circle"));
    expect(story).not.toMatch(/limited|selling fast|best seller|five stars|premium cotton/i);
  });
});
