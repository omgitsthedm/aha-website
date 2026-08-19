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

  // Merchant decision 2026-08-19: sales tax on Arizona destinations only, at
  // the Peoria origin rate. Both the quote and the charge build this order.
  it("adds the Arizona TPT order tax only for AZ destinations", () => {
    const base = { lineItems: [{ catalogObjectId: "SQ_VARIATION", quantity: "1" }] };
    const az = buildSquareOrder({ ...base, shippingAddress: { addressLine1: "1 N Central Ave", locality: "Phoenix", administrativeDistrictLevel1: "AZ", postalCode: "85004", country: "US", firstName: "A", lastName: "B" } });
    expect(az.taxes).toEqual([{ uid: "aha-tax-az", name: "Arizona TPT (Peoria 8.1%)", type: "ADDITIVE", percentage: "8.1", scope: "ORDER" }]);

    // Free-text state: "Arizona", "az." and a blank state with an AZ ZIP all tax.
    for (const state of ["Arizona", "az.", ""]) {
      const order = buildSquareOrder({ ...base, shippingAddress: { addressLine1: "1 N Central Ave", locality: "Phoenix", administrativeDistrictLevel1: state, postalCode: "85004", country: "US", firstName: "A", lastName: "B" } });
      expect(order.taxes?.[0]?.percentage).toBe("8.1");
    }

    // Everywhere else — other states, international, no address — no tax line.
    const ny = buildSquareOrder({ ...base, shippingAddress: { addressLine1: "350 5th Ave", locality: "New York", administrativeDistrictLevel1: "NY", postalCode: "10118", country: "US", firstName: "A", lastName: "B" } });
    expect(ny.taxes).toBeUndefined();
    const ca = buildSquareOrder({ ...base, shippingAddress: { addressLine1: "1 Rue", locality: "Montreal", administrativeDistrictLevel1: "QC", postalCode: "H2X 1Y4", country: "CA", firstName: "A", lastName: "B" } });
    expect(ca.taxes).toBeUndefined();
    expect(buildSquareOrder(base).taxes).toBeUndefined();
  });
});
