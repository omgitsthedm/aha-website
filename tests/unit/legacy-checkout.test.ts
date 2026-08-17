import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/checkout/route";
import { GET as getLegacySizeTable } from "@/app/api/size-table/route";
import { POST as purchaseGiftCard } from "@/app/api/gift-cards/purchase/route";

describe("legacy hosted checkout", () => {
  it("cannot create an order outside the durable AHA payment pipeline", async () => {
    const response = POST();
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      code: "LEGACY_CHECKOUT_DISABLED",
      checkoutUrl: "/checkout",
    });
  });
});

describe("retired product helpers", () => {
  it("does not call Printful for a retired size-table request", async () => {
    const response = getLegacySizeTable();
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    await expect(response.json()).resolves.toMatchObject({
      code: "LEGACY_SIZE_GUIDE_RETIRED",
      table: null,
    });
  });

  it("keeps gift-card charging behind the same closed-catalog policy", async () => {
    const previous = process.env.GIFT_CARDS_ENABLED;
    process.env.GIFT_CARDS_ENABLED = "true";
    try {
      const response = await purchaseGiftCard(new Request("https://afterhoursagenda.test/api/gift-cards/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 500, sourceId: "never-sent", buyerEmail: "buyer@example.com", recipientEmail: "recipient@example.com" }),
      }));
      expect(response.status).toBe(503);
    } finally {
      if (previous === undefined) delete process.env.GIFT_CARDS_ENABLED;
      else process.env.GIFT_CARDS_ENABLED = previous;
    }
  });
});
