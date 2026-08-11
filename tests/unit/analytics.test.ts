import { describe, expect, it } from "vitest";
import { isCanonicalAnalyticsHost } from "@/lib/analytics/host";
import { toGa4Params } from "@/lib/analytics/events";

describe("Google Analytics host boundary", () => {
  it("permits the one public canonical host only", () => {
    expect(isCanonicalAnalyticsHost("afterhoursagenda.com")).toBe(true);
    expect(isCanonicalAnalyticsHost("AFTERHOURSAGENDA.COM.")).toBe(true);
  });

  it.each(["www.afterhoursagenda.com", "afterhoursagenda.netlify.app", "deploy-preview-12--afterhoursagenda.netlify.app", "localhost", "127.0.0.1", undefined])(
    "rejects noncanonical host %s",
    (hostname) => expect(isCanonicalAnalyticsHost(hostname)).toBe(false),
  );
});

describe("GA4 ecommerce payloads", () => {
  it("includes a product name and selected variant for view_item", () => {
    expect(toGa4Params({
      name: "view_item",
      itemId: "shirt-001",
      itemName: "Be You",
      itemVariant: "Black / M",
      valueCents: 4000,
      currency: "USD",
      quantity: 1,
    })).toEqual({
      currency: "USD",
      value: 40,
      items: [{ item_id: "shirt-001", item_name: "Be You", item_variant: "Black / M", price: 40, quantity: 1 }],
    });
  });

  it("includes the product-only cart snapshot for begin_checkout", () => {
    expect(toGa4Params({
      name: "begin_checkout",
      valueCents: 9000,
      currency: "USD",
      quantity: 3,
      items: [
        { itemId: "shirt-001", itemName: "Be You", itemVariant: "Black / M", priceCents: 4000, quantity: 1 },
        { itemId: "hoodie-002", itemName: "Black Sheep", itemVariant: "Bone / L", priceCents: 2500, quantity: 2 },
      ],
    })).toEqual({
      currency: "USD",
      value: 90,
      items: [
        { item_id: "shirt-001", item_name: "Be You", item_variant: "Black / M", price: 40, quantity: 1 },
        { item_id: "hoodie-002", item_name: "Black Sheep", item_variant: "Bone / L", price: 25, quantity: 2 },
      ],
    });
  });
});
