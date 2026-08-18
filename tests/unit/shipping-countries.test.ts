import { describe, expect, it } from "vitest";
import {
  DOMESTIC_COUNTRY,
  INTERNATIONAL_COUNTRIES,
  SHIPPING_COUNTRIES,
  SHIPPING_COUNTRY_NAMES,
  SHIPPING_COUNTRY_OPTIONS,
} from "@/lib/commerce/policies";
import { buildApliiqAddress } from "@/lib/fulfillment/apliiq-adapter";

describe("shipping country policy", () => {
  it("names every enabled market exactly once, US first", () => {
    for (const code of SHIPPING_COUNTRIES) {
      expect(SHIPPING_COUNTRY_NAMES[code]).toMatch(/\S/);
    }
    expect(SHIPPING_COUNTRY_OPTIONS[0]?.code).toBe(DOMESTIC_COUNTRY);
    expect(SHIPPING_COUNTRY_OPTIONS.map((option) => option.code).sort())
      .toEqual([...SHIPPING_COUNTRIES].sort());
    expect(new Set(SHIPPING_COUNTRY_OPTIONS.map((option) => option.code)).size).toBe(SHIPPING_COUNTRIES.length);
  });

  it("lets the APLIIQ adapter name a code-only address for every enabled market", () => {
    // The checkout stores the ISO code only. Before the names lived in the
    // policy table, anything past US/CA/GB/AU threw here and the paid order
    // dead-ended in manual review.
    for (const code of INTERNATIONAL_COUNTRIES) {
      const address = buildApliiqAddress({
        email: "buyer@example.com",
        shippingName: "Ada Lovelace",
        shippingAddress: { address1: "1 Example Street", city: "Town", state: "Region", zip: "00000", country: code },
      } as never);
      expect(address.countryCode).toBe(code);
      expect(address.country).toBe(SHIPPING_COUNTRY_NAMES[code]);
    }
  });
});
