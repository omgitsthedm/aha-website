import { describe, expect, it } from "vitest";
import { buildProductStory } from "@/lib/content/product-copy";
import type { Product, Collection } from "@/lib/utils/types";

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

const collection: Collection = {
  id: "night-mode",
  slug: "night-mode",
  name: "Night Mode",
  description: "For the hours between midnight and dawn.",
  accent: "blue",
};

describe("buildProductStory", () => {
  it("replaces generic provider copy with specific brand and collection context", () => {
    const story = buildProductStory(product("Be You"), null, collection);

    expect(story).toContain("Be You puts the graphic front and center");
    expect(story).toContain(collection.description);
    expect(story).toContain("free shipping");
    expect(story).not.toContain("comfortable, soft, lightweight");
  });

  it("produces distinct copy for distinct products", () => {
    expect(buildProductStory(product("Be You"))).not.toBe(
      buildProductStory(product("Cities")),
    );
  });
});
