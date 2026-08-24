import { describe, expect, it } from "vitest";
import { buildChannelListings, buildGoogleProductFeed, buildMetaProductFeed, buildProductFeed } from "@/lib/seo/product-feed";
import type { Product } from "@/lib/utils/types";

const product: Product = {
  id: "item-1", slug: "black-sheep-tee", name: "Black Sheep & Co — Tee", description: "<p>Made <strong>after hours</strong>.</p>",
  price: 5200, priceFormatted: "$52.00", currency: "USD", images: ["/products/black-sheep-tee/01-front.webp", "https://images.example/detail.jpg"],
  collectionIds: ["collection-1"], collectionNames: ["Black Sheep"],
  variations: [
    { id: "variation-1", sku: "AHA-1-M", name: "Black / M", price: 5200, priceFormatted: "$52.00", ordinal: 0 },
    { id: "variation-2", sku: "AHA-1-L", name: "Black / L", price: 5200, priceFormatted: "$52.00", ordinal: 1 },
  ],
};

const enrichment = {
  fitDescription: "Relaxed",
  fabricDescription: "100% cotton",
  careInstructions: "Wash cold",
  productType: "tee",
  purchasableBySize: {
    M: { ok: true, reasons: [] },
    L: { ok: false, reasons: ["not approved"] },
  },
  catIdBySize: {},
  colors: ["Black"],
};

const resolveEnrichment = () => enrichment;

describe("product feed", () => {
  it("builds one complete canonical listing per sellable variant", () => {
    const listings = buildChannelListings([product], "https://afterhoursagenda.com/", resolveEnrichment);

    expect(listings).toEqual([expect.objectContaining({
      id: "AHA-1-M",
      groupId: "AHA-1",
      title: "Black Sheep & Co Graphic Tee — M",
      description: "Made after hours.",
      price: "52.00",
      link: "https://afterhoursagenda.com/product/black-sheep-tee",
      imageLink: "https://afterhoursagenda.com/products/black-sheep-tee/01-front.webp",
      additionalImageLinks: ["https://images.example/detail.jpg"],
      brand: "After Hours Agenda",
      color: "Black",
      size: "M",
      gender: "unisex",
      ageGroup: "adult",
      material: "100% cotton",
      googleProductCategory: "Apparel & Accessories > Clothing > Shirts & Tops",
      identifierExists: false,
      shipping: "US::Standard:0.00 USD",
    })]);
  });

  it("renders the same canonical data for Meta CSV and Google RSS", () => {
    const listings = buildChannelListings([product], "https://afterhoursagenda.com", resolveEnrichment);
    const meta = buildMetaProductFeed(listings);
    const google = buildGoogleProductFeed(listings, "https://afterhoursagenda.com");
    const legacy = buildProductFeed([product], "https://afterhoursagenda.com", resolveEnrichment);

    expect(meta).toContain("identifier_exists");
    expect(meta).toContain('"AHA-1-M"');
    expect(meta).toContain('"US::Standard:0.00 USD"');
    expect(google).toContain("<g:item_group_id>AHA-1</g:item_group_id>");
    expect(google).toContain("<g:identifier_exists>false</g:identifier_exists>");
    expect(google).toContain("<g:material>100% cotton</g:material>");
    expect(google).toContain("<g:shipping>");
    expect(google).not.toMatch(/Review|AggregateRating|rating/i);
    expect(legacy).toBe(google);
  });

  it("never lists a product that is absent from the sellability enrichment", () => {
    expect(buildChannelListings([product], "https://afterhoursagenda.com", () => null)).toEqual([]);
  });
});
