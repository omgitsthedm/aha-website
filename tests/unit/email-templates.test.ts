import { describe, expect, it } from "vitest";
import { DELIVERY_WINDOW, PRODUCTION_WINDOW } from "@/lib/commerce/policies";
import { renderOrderEmail } from "@/lib/email/templates";

describe("transactional order email", () => {
  it("renders branded order content and escapes customer-facing snapshots", () => {
    const result = renderOrderEmail({
      kind: "order_confirmed", orderNumber: "AHA-123", totalAmount: 2500, currency: "USD",
      items: [{ title: "Night <Script> Tee", size: "L", quantity: 1, lineTotal: 2500 }],
    });
    expect(result.subject).toContain("AHA-123");
    expect(result.html).toContain("$25.00");
    expect(result.html).toContain("Night &lt;Script&gt; Tee");
    expect(result.html).not.toContain("Night <Script> Tee");
  });

  // The email is the artefact the customer keeps, so it has to answer "when does
  // it arrive" and "where do I check" without going back to the site by memory.
  it("states the production and delivery windows in the confirmation email", () => {
    const result = renderOrderEmail({
      kind: "order_confirmed", orderNumber: "AHA-123", totalAmount: 2500, currency: "USD",
      items: [{ title: "Classic Hoodie", size: "L", quantity: 1, lineTotal: 2500 }],
    });
    expect(result.html).toContain(PRODUCTION_WINDOW);
    expect(result.html).toContain(DELIVERY_WINDOW);
    expect(result.text).toContain(PRODUCTION_WINDOW);
    expect(result.text).toContain(DELIVERY_WINDOW);
  });

  it("links the order-status page from every email without a carrier link", () => {
    for (const kind of ["order_confirmed", "order_in_production", "fulfillment_attention"] as const) {
      const result = renderOrderEmail({
        kind, orderNumber: "AHA-123", totalAmount: 2500, currency: "USD",
        items: [{ title: "Classic Hoodie", size: "L", quantity: 1, lineTotal: 2500 }],
      });
      expect(result.html).toContain("/track-order");
      expect(result.text).toContain("Order status: ");
      expect(result.text).toContain("/track-order");
    }
  });

  it("adds a secure tracking link to shipped email", () => {
    const result = renderOrderEmail({
      kind: "order_shipped", orderNumber: "AHA-456", totalAmount: 600, currency: "USD",
      trackingUrl: "https://carrier.example/track/123", carrier: "Carrier", trackingNumber: "123",
      items: [{ title: "Sticker", quantity: 1, lineTotal: 600 }],
    });
    expect(result.html).toContain("https://carrier.example/track/123");
    expect(result.text).toContain("Tracking: https://carrier.example/track/123");
    // The carrier button is the one CTA on a shipped email — no second lookup link.
    expect(result.html).not.toContain("/track-order");
  });
});
