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

  it("puts the apartment line on the Square shipment recipient", () => {
    const withUnit = buildSquareOrder({
      lineItems: [{ catalogObjectId: "SQ_VARIATION", quantity: "1" }],
      shippingAddress: {
        addressLine1: "1 Main Street", addressLine2: "Apt 4B", locality: "Brooklyn",
        administrativeDistrictLevel1: "NY", postalCode: "11201", country: "US",
        firstName: "Taylor", lastName: "Customer",
      },
    });
    expect(withUnit.fulfillments[0].shipment_details.recipient.address.address_line_2).toBe("Apt 4B");

    // An address with no unit must not ship an empty line to Square.
    const withoutUnit = buildSquareOrder({
      lineItems: [{ catalogObjectId: "SQ_VARIATION", quantity: "1" }],
      shippingAddress: {
        addressLine1: "1 Main Street", locality: "Brooklyn",
        administrativeDistrictLevel1: "NY", postalCode: "11201", country: "US",
        firstName: "Taylor", lastName: "Customer",
      },
    });
    expect(withoutUnit.fulfillments[0].shipment_details.recipient.address.address_line_2).toBeUndefined();
    expect(JSON.parse(JSON.stringify(withoutUnit)).fulfillments[0].shipment_details.recipient.address)
      .not.toHaveProperty("address_line_2");
  });
});
