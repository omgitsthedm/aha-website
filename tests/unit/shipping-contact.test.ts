import { describe, expect, it } from "vitest";
import { getAddressError, getSubmissionBlockReason, type ShippingContact } from "@/lib/checkout/shipping-contact";
import { verifyPostalCode, type PostalLookup } from "@/lib/checkout/postal-verification";

const brooklyn: PostalLookup = {
  status: "resolved",
  places: [{ city: "Brooklyn", state: "New York", stateCode: "NY" }],
};

function contact(overrides: Partial<ShippingContact> = {}): ShippingContact {
  return {
    email: "customer@example.com",
    shippingName: "Taylor Customer",
    address1: "1 Main Street",
    address2: "Apt 4B",
    city: "Brooklyn",
    state: "NY",
    zip: "11201",
    country: "US",
    ...overrides,
  };
}

function reason(c: ShippingContact, lookup: PostalLookup): string | null {
  return getSubmissionBlockReason(c, verifyPostalCode({ ...c, lookup }));
}

describe("shipping address completeness", () => {
  it("never requires the apartment line — plenty of addresses have no unit", () => {
    expect(getAddressError(contact({ address2: "" }))).toBeNull();
    expect(reason(contact({ address2: "" }), brooklyn)).toBeNull();
  });

  it("still requires the fields it always required", () => {
    expect(getAddressError(contact({ shippingName: "" }))).toBe("Enter the name for shipping.");
    expect(getAddressError(contact({ address1: "" }))).toBe("Complete your shipping address.");
    expect(getAddressError(contact({ city: "" }))).toBe("Complete your shipping address.");
    expect(getAddressError(contact({ zip: "" }))).toBe("Complete your shipping address.");
    expect(getAddressError(contact({ state: "" }))).toBe("State/province is required.");
    expect(getAddressError(contact({ state: "", country: "GB" }))).toBeNull();
  });
});

describe("submission gate", () => {
  it("passes a complete, verified address", () => {
    expect(reason(contact(), brooklyn)).toBeNull();
  });

  it("checks email and address completeness before the postal verdict", () => {
    expect(reason(contact({ email: "not-an-email" }), brooklyn)).toBe("Enter a valid email for your receipt.");
    // Even a blocking postal verdict (Boston typed against a Brooklyn ZIP)
    // must not jump the queue ahead of the fields the shopper can see.
    expect(reason(contact({ email: "", city: "Boston", state: "MA" }), brooklyn))
      .toBe("Enter a valid email for your receipt.");
    expect(reason(contact({ address1: "", city: "Boston", state: "MA" }), brooklyn))
      .toBe("Complete your shipping address.");
  });

  it("STOPS a ZIP that contradicts the typed city and state", () => {
    // The whole point: this order would ship to Brooklyn while the shopper
    // waits in Boston, then come back to AHA at AHA's cost.
    const blocked = reason(contact({ city: "Boston", state: "MA" }), brooklyn);
    expect(blocked).toContain("11201 is Brooklyn, NY");
    expect(blocked).toContain("not Boston, MA");
  });

  it("does NOT stop a ZIP the free dataset simply does not carry", () => {
    // The inverse of what this test used to assert. api.zippopotam.us 404s on
    // deliverable APO/FPO and US-territory ZIPs, so treating "not found" as
    // fatal refused military families and territory customers at the Pay
    // button — worse than the return-to-sender it was meant to prevent.
    expect(reason(contact({ zip: "09021", city: "APO", state: "AE" }), { status: "not-in-dataset" })).toBeNull();
    expect(reason(contact({ zip: "00901", city: "San Juan", state: "PR" }), { status: "not-in-dataset" })).toBeNull();
    expect(reason(contact({ zip: "96910", city: "Hagatna", state: "GU" }), { status: "not-in-dataset" })).toBeNull();
    expect(reason(contact({ zip: "96799", city: "Pago Pago", state: "AS" }), { status: "not-in-dataset" })).toBeNull();
    expect(reason(contact({ zip: "00000" }), { status: "not-in-dataset" })).toBeNull();
  });

  it("STOPS a malformed ZIP with no lookup at all", () => {
    expect(reason(contact({ zip: "112" }), { status: "idle" })).toBe("Enter a valid 5-digit US ZIP code.");
  });

  it("holds submission while the check is still in flight", () => {
    expect(reason(contact(), { status: "checking" })).toBe("Confirming your ZIP code — one moment.");
  });

  it("does NOT stop the sale when the lookup is unreachable", () => {
    // Offline, CSP, 5xx, timeout — the sale must still go through, even with a
    // city/state that a reachable service would have rejected.
    expect(reason(contact({ city: "Boston", state: "MA" }), { status: "unavailable" })).toBeNull();
    expect(reason(contact({ city: "Boston", state: "MA" }), { status: "resolved", places: [] })).toBeNull();
  });

  it("does not check countries whose full postcode cannot be resolved", () => {
    expect(reason(contact({ country: "CA", state: "ON", city: "Toronto", zip: "M5V 2T6" }), { status: "idle" })).toBeNull();
    expect(reason(contact({ country: "GB", state: "", city: "London", zip: "SW1A 1AA" }), { status: "idle" })).toBeNull();
  });
});
