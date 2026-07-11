import { describe, expect, it } from "vitest";
import { buildProductFeed } from "@/lib/seo/product-feed";
import type { Product } from "@/lib/utils/types";

const product: Product = {
  id: "item-1", slug: "black-sheep-tee", name: "Black Sheep & Co", description: "<p>Made <strong>after hours</strong>.</p>",
  price: 5200, priceFormatted: "$52.00", currency: "USD", images: ["https://images.example/item.jpg"],
  collectionIds: ["collection-1"], collectionNames: ["Black Sheep"],
  variations: [{ id: "variation-1", sku: "AHA-1-M", name: "Black / M", price: 5200, priceFormatted: "$52.00", ordinal: 0 }],
};

describe("product feed", () => {
  it("emits variant product data without review or rating claims", () => {
    const feed = buildProductFeed([product], "https://afterhoursagenda.com");
    expect(feed).toContain("<g:id>AHA-1-M</g:id>");
    expect(feed).toContain("Black Sheep &amp; Co");
    expect(feed).toContain("<g:price>52.00 USD</g:price>");
    expect(feed).toContain("<g:shipping>");
    expect(feed).not.toMatch(/Review|AggregateRating|rating/i);
  });
});
