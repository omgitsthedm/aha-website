import { describe, expect, it } from "vitest";
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

  it("adds a secure tracking link to shipped email", () => {
    const result = renderOrderEmail({
      kind: "order_shipped", orderNumber: "AHA-456", totalAmount: 600, currency: "USD",
      trackingUrl: "https://carrier.example/track/123", carrier: "Carrier", trackingNumber: "123",
      items: [{ title: "Sticker", quantity: 1, lineTotal: 600 }],
    });
    expect(result.html).toContain("https://carrier.example/track/123");
    expect(result.text).toContain("Tracking: https://carrier.example/track/123");
  });
});
