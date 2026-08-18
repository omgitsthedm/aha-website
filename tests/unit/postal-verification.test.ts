import { describe, expect, it } from "vitest";
import {
  isPostalVerifiableCountry,
  normalizePlaceName,
  parseZippopotamPlaces,
  postalLookupCode,
  postalLookupUrl,
  verifyPostalCode,
  type PostalLookup,
} from "@/lib/checkout/postal-verification";

const brooklyn = { city: "Brooklyn", state: "New York", stateCode: "NY" };
const resolved = (...places: Array<{ city: string; state: string; stateCode: string }>): PostalLookup => ({
  status: "resolved",
  places,
});

describe("postalLookupCode — what we are willing to check", () => {
  it("reduces a US ZIP+4 to the 5-digit code zippopotam expects", () => {
    expect(postalLookupCode("US", "11201-1234")).toBe("11201");
    expect(postalLookupCode("US", " 11201 ")).toBe("11201");
    expect(postalLookupCode("us", "11201")).toBe("11201");
  });

  it("returns null for a malformed code so no request is made", () => {
    expect(postalLookupCode("US", "1120")).toBeNull();
    expect(postalLookupCode("US", "ABCDE")).toBeNull();
    expect(postalLookupCode("US", "")).toBeNull();
    expect(postalLookupCode("AU", "300")).toBeNull();
  });

  it("skips countries whose full postcode does not resolve 1:1 (CA FSA, GB outcode)", () => {
    // A blocking check there would refuse every legitimate Canadian/UK order.
    expect(isPostalVerifiableCountry("CA")).toBe(false);
    expect(isPostalVerifiableCountry("GB")).toBe(false);
    expect(isPostalVerifiableCountry("US")).toBe(true);
    expect(isPostalVerifiableCountry("au")).toBe(true);
    expect(postalLookupCode("CA", "K1A 0B1")).toBeNull();
    expect(postalLookupCode("GB", "SW1A 1AA")).toBeNull();
  });

  it("builds the lookup URL with a lowercase country", () => {
    expect(postalLookupUrl("US", "11201")).toBe("https://api.zippopotam.us/us/11201");
  });
});

describe("parseZippopotamPlaces", () => {
  it("reads the documented response shape", () => {
    expect(parseZippopotamPlaces({
      "post code": "11201",
      places: [{ "place name": "Brooklyn", state: "New York", "state abbreviation": "NY" }],
    })).toEqual([brooklyn]);
  });

  it("survives every malformed shape without throwing", () => {
    expect(parseZippopotamPlaces(null)).toEqual([]);
    expect(parseZippopotamPlaces(undefined)).toEqual([]);
    expect(parseZippopotamPlaces({})).toEqual([]);
    expect(parseZippopotamPlaces({ places: "nope" })).toEqual([]);
    expect(parseZippopotamPlaces({ places: [null, 7, { state: "New York" }] })).toEqual([]);
  });

  it("falls back between the state name and its abbreviation", () => {
    expect(parseZippopotamPlaces({ places: [{ "place name": "Brooklyn", "state abbreviation": "NY" }] }))
      .toEqual([{ city: "Brooklyn", state: "NY", stateCode: "NY" }]);
    expect(parseZippopotamPlaces({ places: [{ "place name": "Melbourne", state: "Victoria" }] }))
      .toEqual([{ city: "Melbourne", state: "Victoria", stateCode: "Victoria" }]);
  });
});

describe("normalizePlaceName", () => {
  it("ignores case, accents, punctuation and common abbreviations", () => {
    expect(normalizePlaceName("St. Louis")).toBe(normalizePlaceName("Saint Louis"));
    expect(normalizePlaceName("MONTRÉAL")).toBe(normalizePlaceName("montreal"));
    expect(normalizePlaceName("Ft.  Worth")).toBe(normalizePlaceName("Fort Worth"));
    expect(normalizePlaceName("Mt Vernon")).toBe(normalizePlaceName("Mount Vernon"));
  });
});

describe("verifyPostalCode — only a definitive contradiction stops a sale", () => {
  const base = { country: "US", zip: "11201", city: "Brooklyn", state: "NY" };

  it("stays out of the way before there is anything to check", () => {
    expect(verifyPostalCode({ ...base, zip: "", lookup: { status: "idle" } })).toEqual({ status: "skipped" });
    expect(verifyPostalCode({ ...base, country: "CA", zip: "K1A 0B1", lookup: { status: "idle" } }))
      .toEqual({ status: "skipped" });
    expect(verifyPostalCode({ ...base, lookup: { status: "idle" } })).toEqual({ status: "skipped" });
    expect(verifyPostalCode({ ...base, lookup: { status: "checking" } })).toEqual({ status: "checking" });
  });

  it("blocks a locally invalid format with no network call at all", () => {
    const verdict = verifyPostalCode({ ...base, zip: "112", lookup: { status: "idle" } });
    expect(verdict.status).toBe("blocked");
    expect(verdict.status === "blocked" && verdict.message).toBe("Enter a valid 5-digit US ZIP code.");
    const au = verifyPostalCode({ country: "AU", zip: "30", city: "Melbourne", state: "VIC", lookup: { status: "idle" } });
    expect(au.status === "blocked" && au.message).toBe("Enter a valid 4-digit Australian postcode.");
  });

  it("NEVER blocks when the lookup itself is unreachable", () => {
    // Offline / CSP / 5xx / timeout. A free third-party service with no SLA
    // must not be able to stop the store from taking money.
    expect(verifyPostalCode({ ...base, city: "Boston", state: "MA", lookup: { status: "unavailable" } }))
      .toEqual({ status: "unverified" });
    expect(verifyPostalCode({ ...base, lookup: resolved() })).toEqual({ status: "unverified" });
  });

  it("NEVER blocks a code the free dataset has never heard of", () => {
    // The inverse of the rule this file used to pin. api.zippopotam.us is a
    // GeoNames extract, not USPS: probed live it 404s on 09021/09501 (APO),
    // 00901/00601/00926 (PR), 96910 (GU), 00802 (VI) and 96799 (AS) — all
    // deliverable. "Absent from this dataset" is not "no such ZIP".
    for (const [zip, city, state] of [
      ["09021", "APO", "AE"], ["09501", "APO", "AA"],
      ["00901", "San Juan", "PR"], ["00601", "Adjuntas", "PR"], ["00926", "San Juan", "PR"],
      ["96910", "Hagatna", "GU"], ["00802", "St Thomas", "VI"], ["96799", "Pago Pago", "AS"],
      ["00000", "Nowhere", "NY"],
    ]) {
      expect(verifyPostalCode({ ...base, zip, city, state, lookup: { status: "not-in-dataset" } }), zip)
        .toEqual({ status: "unverified" });
    }
  });

  it("has no lookup status that can refuse a well-formed code on its own", () => {
    // `satisfies` stops compiling the moment PostalLookup grows a variant, so a
    // future status cannot be added without deciding here whether it may block.
    const everyStatus = {
      idle: { status: "idle" },
      checking: { status: "checking" },
      resolved: { status: "resolved", places: [brooklyn] },
      "not-in-dataset": { status: "not-in-dataset" },
      unavailable: { status: "unavailable" },
    } satisfies Record<PostalLookup["status"], PostalLookup>;
    for (const [name, lookup] of Object.entries(everyStatus)) {
      expect(verifyPostalCode({ ...base, lookup }).status, name).not.toBe("blocked");
    }
  });

  it("cannot be routed back into a block by the deleted 'unknown' status", () => {
    // The real assertion is the typecheck: the variant was removed so that a
    // future edit reaching for it fails `npm run typecheck` instead of quietly
    // refusing APO/territory shoppers again. Re-add the variant and the
    // suppression below goes unused, which is itself a tsc error.
    // @ts-expect-error - the "unknown" variant no longer exists.
    const reintroduced: PostalLookup = { status: "unknown" };
    // And at runtime a status we do not recognise must still fail open.
    expect(verifyPostalCode({ ...base, lookup: reintroduced })).toEqual({ status: "unverified" });
  });

  it("passes a matching city and state", () => {
    expect(verifyPostalCode({ ...base, lookup: resolved(brooklyn) }))
      .toEqual({ status: "ok", place: { city: "Brooklyn", state: "NY" } });
    // Full state name typed instead of the code.
    expect(verifyPostalCode({ ...base, state: "New York", lookup: resolved(brooklyn) }).status).toBe("ok");
    // Any of the places a shared code serves is enough.
    expect(verifyPostalCode({
      ...base, city: "Bellerose", state: "NY",
      lookup: resolved(brooklyn, { city: "Bellerose", state: "New York", stateCode: "NY" }),
    }).status).toBe("ok");
  });

  it("blocks a contradicting state and offers the resolved place as a one-tap fix", () => {
    const verdict = verifyPostalCode({ ...base, city: "Boston", state: "MA", lookup: resolved(brooklyn) });
    expect(verdict.status).toBe("blocked");
    expect(verdict.status === "blocked" && verdict.suggestion).toEqual({ city: "Brooklyn", state: "NY" });
    expect(verdict.status === "blocked" && verdict.message).toContain("11201 is Brooklyn, NY");
    expect(verdict.status === "blocked" && verdict.message).toContain("not Boston, MA");
  });

  it("blocks a contradicting city inside the right state", () => {
    expect(verifyPostalCode({ ...base, city: "Albany", lookup: resolved(brooklyn) }).status).toBe("blocked");
  });

  it("does not block a delivery-equivalent NYC name", () => {
    // USPS delivers on the ZIP; AHA's home market types these interchangeably.
    expect(verifyPostalCode({ ...base, city: "New York", lookup: resolved(brooklyn) }).status).toBe("ok");
    expect(verifyPostalCode({ ...base, city: "NYC", lookup: resolved(brooklyn) }).status).toBe("ok");
    // The tolerance is scoped to New York, not applied everywhere.
    expect(verifyPostalCode({
      country: "US", zip: "02134", city: "New York", state: "MA",
      lookup: resolved({ city: "Allston", state: "Massachusetts", stateCode: "MA" }),
    }).status).toBe("blocked");
  });

  it("does not block on spelling or accent variants of the same city", () => {
    expect(verifyPostalCode({
      country: "US", zip: "63101", city: "St. Louis", state: "MO",
      lookup: resolved({ city: "Saint Louis", state: "Missouri", stateCode: "MO" }),
    }).status).toBe("ok");
  });

  it("leaves an empty city/state to the required-field check", () => {
    expect(verifyPostalCode({ ...base, city: "", state: "", lookup: resolved(brooklyn) }))
      .toEqual({ status: "ok", place: { city: "Brooklyn", state: "NY" } });
    expect(verifyPostalCode({ ...base, city: "", lookup: resolved(brooklyn) }).status).toBe("ok");
  });
});
