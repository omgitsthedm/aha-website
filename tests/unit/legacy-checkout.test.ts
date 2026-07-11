import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/checkout/route";

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
