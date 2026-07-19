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
