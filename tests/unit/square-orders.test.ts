import { describe, expect, it } from "vitest";
import { buildSquareOrder, parseSquareOrderTotals } from "@/lib/square/orders";

describe("Square order pricing", () => {
  it("parses the tax-inclusive total Square returns", () => {
    expect(parseSquareOrderTotals({
      total_money: { amount: 5443, currency: "USD" },
      total_tax_money: { amount: 443 },
    })).toEqual({ subtotal: 5000, tax: 443, total: 5443, currency: "USD" });
  });

  it("builds the same trusted order shape for quote and charge", () => {
    const order = buildSquareOrder({
      lineItems: [{ catalogObjectId: "SQ_VARIATION", quantity: "2" }],
      shippingAddress: {
        addressLine1: "350 5th Ave", locality: "New York",
        administrativeDistrictLevel1: "NY", postalCode: "10118", country: "US",
        firstName: "AHA", lastName: "Customer",
      },
    });

    expect(order.pricing_options).toEqual({ auto_apply_taxes: true });
    expect(order.line_items).toEqual([{ catalog_object_id: "SQ_VARIATION", quantity: "2" }]);
    expect(order.fulfillments[0].shipment_details.recipient.address.postal_code).toBe("10118");
  });
});
