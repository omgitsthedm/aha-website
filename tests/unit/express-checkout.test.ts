import { describe, it, expect } from "vitest";
import { extractExpressContact, expressTotalAmount } from "@/lib/checkout/express";

describe("extractExpressContact — defensive wallet parsing", () => {
  it("parses a full Apple/Google Pay shipping contact", () => {
    const c = extractExpressContact({
      shipping: { contact: { email: "a@b.com", givenName: "Ada", familyName: "Lovelace", addressLine1: "1 Main St", city: "Brooklyn", state: "NY", postalCode: "11201", countryCode: "US" } },
    });
    expect(c).toEqual({
      email: "a@b.com", shippingName: "Ada Lovelace",
      shippingAddress: { address1: "1 Main St", city: "Brooklyn", state: "NY", zip: "11201", country: "US" },
    });
  });

  it("falls back to billing email + flat shipping shape", () => {
    const c = extractExpressContact({
      shipping: { address1: "5 Ave", locality: "NYC", zip: "10001" },
      billing: { contact: { email: "x@y.com" } },
    });
    expect(c?.email).toBe("x@y.com");
    expect(c?.shippingAddress.city).toBe("NYC");
    expect(c?.shippingAddress.country).toBe("US");
  });

  it("keeps the wallet's apartment line — dropping it makes the parcel undeliverable", () => {
    const squareShape = extractExpressContact({
      shipping: { contact: { email: "a@b.com", name: "Ada", addressLine1: "1 Main St", addressLine2: "Apt 4B", city: "Brooklyn", state: "NY", postalCode: "11201" } },
    });
    expect(squareShape?.shippingAddress.address2).toBe("Apt 4B");

    // Apple Pay's native contact carries the street as an array.
    const appleShape = extractExpressContact({
      shipping: { contact: { email: "a@b.com", name: "Ada", addressLines: ["1 Main St", "Apt 4B"], city: "Brooklyn", state: "NY", postalCode: "11201" } },
    });
    expect(appleShape?.shippingAddress).toMatchObject({ address1: "1 Main St", address2: "Apt 4B" });

    expect(extractExpressContact({
      shipping: { contact: { email: "a@b.com", name: "Ada", line1: "1 Main St", line2: "Unit 7", city: "Brooklyn", postalCode: "11201" } },
    })?.shippingAddress.address2).toBe("Unit 7");
  });

  it("omits address2 entirely when the wallet has no second line", () => {
    const c = extractExpressContact({
      shipping: { contact: { email: "a@b.com", name: "Ada", addressLine1: "1 Main St", addressLine2: "  ", city: "Brooklyn", postalCode: "11201" } },
    });
    expect(c?.shippingAddress).not.toHaveProperty("address2");
  });

  it("returns null when required fields are missing (→ caller falls back to /checkout)", () => {
    expect(extractExpressContact({ shipping: { contact: { givenName: "No", familyName: "Address" } } })).toBeNull();
    expect(extractExpressContact({})).toBeNull();
    expect(extractExpressContact(null)).toBeNull();
  });
});

describe("expressTotalAmount", () => {
  it("formats cents to a dollars string", () => {
    expect(expressTotalAmount(3400)).toBe("34.00");
    expect(expressTotalAmount(0)).toBe("0.00");
    expect(expressTotalAmount(-5)).toBe("0.00");
  });
});
