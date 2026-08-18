import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ApliiqShippingRateError,
  FLAT_RATE_MAX_UNITS_PER_ORDER,
  __setApliiqShippingRateTableForTest,
  checkInternationalFlatRateCoverage,
  findApliiqInternationalZone,
  getApliiqDomesticShippingCents,
  getApliiqFulfillmentFeeCentsPerUnit,
  getApliiqInternationalShippingCents,
  getApliiqShippingCents,
  isInternationalFlatRateUnderwater,
  loadApliiqShippingRates,
  lookupTierRateCents,
  parseApliiqShippingRateTable,
} from "@/lib/commerce/apliiq-shipping-rates";
import { APLIIQ_FULFILLMENT_FEE_CENTS_DEFAULT } from "@/db/schema";
import { INTERNATIONAL_SHIPPING_CENTS } from "@/lib/commerce/policies";

const LADDER: ReadonlyArray<[number, number]> = [
  [7.9, 596], [11.9, 692], [15.9, 885], [31.9, 1180], [47.9, 1565], [63.9, 1885],
  [79.9, 2224], [95.9, 2896], [111.9, 3005], [127.9, 3225], [143.99, 3405],
  [159.84, 3585], [239.84, 4055], [319.84, 5295], [399.84, 6150], [479.84, 7899],
];

function fixture(zones: unknown[]): unknown {
  return {
    schemaVersion: 1,
    effectiveDate: "2026-05-12",
    currency: "USD",
    billing: { fulfillmentFeeCentsPerUnit: 100 },
    domestic: { destinationCountry: "US", service: "standard", tiers: [{ maxWeightOz: 7.9, rateCents: 596 }] },
    international: { zones },
  };
}

afterEach(() => __setApliiqShippingRateTableForTest(undefined));

describe("APLIIQ shipping rate table", () => {
  it("commits the dated US rate sheet exactly as published", () => {
    const table = loadApliiqShippingRates();
    expect(table.effectiveDate).toBe("2026-05-12");
    expect(table.currency).toBe("USD");
    expect(table.domestic.destinationCountry).toBe("US");
    expect(table.domestic.tiers.map((tier) => [tier.maxWeightOz, tier.rateCents])).toEqual(
      LADDER.map(([weight, rate]) => [weight, rate])
    );
  });

  it("keeps the per-product fulfillment fee in step with the database default", () => {
    // Two sources of the $1.00 fee (rate sheet + product_variants default) must
    // never drift apart.
    expect(getApliiqFulfillmentFeeCentsPerUnit()).toBe(100);
    expect(getApliiqFulfillmentFeeCentsPerUnit()).toBe(APLIIQ_FULFILLMENT_FEE_CENTS_DEFAULT);
  });

  it("ships only sourced international rates, never an invented or zero one", () => {
    const { zones } = loadApliiqShippingRates().international;
    // Populated 2026-08-17 from the merchant-supplied APLIIQ sheet
    // 2026-08-11_ShippingRates.csv. Before that this asserted an empty list,
    // because inventing a rate is worse than refusing to quote one.
    expect(zones.length).toBeGreaterThan(200);
    expect(findApliiqInternationalZone("CA")).toBeDefined();

    // A $0.00 row in the source means APLIIQ has no service at that weight, not
    // free shipping. Those rows are dropped at import; none may survive here.
    for (const zone of zones) {
      for (const tier of zone.tiers) {
        expect(tier.rateCents).toBeGreaterThan(0);
        expect(Number.isInteger(tier.rateCents)).toBe(true);
      }
    }
  });
});

describe("irregular-tier lookup", () => {
  it.each(LADDER.map(([weightOz, rateCents]) => [weightOz, rateCents] as const))(
    "charges %s oz at its own ceiling rate %s",
    (weightOz, rateCents) => {
      expect(getApliiqDomesticShippingCents(weightOz)).toBe(rateCents);
    }
  );

  it.each([
    [0.01, 596], [7.89, 596], [7.91, 692], [8, 692], [12, 885], [16, 1180],
    [32, 1565], [128, 3405], [143.98, 3405], [144, 3585], [159.85, 4055], [400, 7899],
  ])("rounds %s oz up into the next published tier (%s)", (weightOz, rateCents) => {
    expect(getApliiqDomesticShippingCents(weightOz)).toBe(rateCents);
  });

  it("does not assume a uniform tier step", () => {
    const ceilings = loadApliiqShippingRates().domestic.tiers.map((tier) => tier.maxWeightOz);
    const steps = new Set(ceilings.slice(1).map((value, index) => Number((value - ceilings[index]).toFixed(2))));
    expect(steps.size).toBeGreaterThan(1);
    // A uniform-step guess from the first gap would put 32 oz in the 15.9 tier.
    expect(getApliiqDomesticShippingCents(32)).not.toBe(885);
  });

  it("normalizes a float-drifted weight back onto its exact tier ceiling", () => {
    expect(7.9).not.toBe(7.8 + 0.1);
    expect(getApliiqDomesticShippingCents(7.8 + 0.1)).toBe(596);
  });

  it("throws over the last published tier instead of clamping to it", () => {
    // Clamping is what would silently bless an underwater SKU.
    expect(() => getApliiqDomesticShippingCents(479.85)).toThrow(ApliiqShippingRateError);
    expect(() => getApliiqDomesticShippingCents(479.85)).toThrow("publishes no shipping rate above 479.84 oz");
    try {
      getApliiqDomesticShippingCents(1000);
      expect.unreachable("over-max weight must not resolve to a rate");
    } catch (error) {
      expect(error).toBeInstanceOf(ApliiqShippingRateError);
      expect((error as ApliiqShippingRateError).kind).toBe("over_max_weight");
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects the non-weight %s", (weightOz) => {
    try {
      getApliiqDomesticShippingCents(weightOz as number);
      expect.unreachable("a non-positive or non-finite weight must not resolve to a rate");
    } catch (error) {
      expect((error as ApliiqShippingRateError).kind).toBe("invalid_weight");
    }
  });

  it("binary-searches an arbitrary irregular table without interpolating", () => {
    const tiers = [
      { maxWeightOz: 1, rateCents: 100 },
      { maxWeightOz: 50, rateCents: 200 },
      { maxWeightOz: 51, rateCents: 900 },
    ];
    expect(lookupTierRateCents(tiers, 1)).toBe(100);
    expect(lookupTierRateCents(tiers, 25)).toBe(200);
    expect(lookupTierRateCents(tiers, 50.5)).toBe(900);
    expect(() => lookupTierRateCents(tiers, 51.01)).toThrow(ApliiqShippingRateError);
  });
});

describe("international freight", () => {
  it("refuses to quote a destination with no verified zone", () => {
    // AQ (Antarctica) is genuinely absent from the APLIIQ sheet. CA and GB are
    // now modelled, so they can no longer stand in for an unmodelled country.
    try {
      getApliiqInternationalShippingCents("AQ", 7.9);
      expect.unreachable("an unmodelled destination must not resolve to a rate");
    } catch (error) {
      expect((error as ApliiqShippingRateError).kind).toBe("unmodelled_destination");
      expect((error as Error).message).toContain("AQ");
    }
  });

  it("quotes a modelled destination from the sourced ladder", () => {
    expect(getApliiqInternationalShippingCents("GB", 7.9)).toBe(1489);
    expect(getApliiqShippingCents("GB", 7.9)).toBe(1489);
  });

  it("tolerates a carrier service break where a heavier tier is cheaper", () => {
    // Austria: 70.4 oz = $74.84, then 80.0 oz = $56.05. Real APLIIQ pricing —
    // a different service takes over. The parser must not reject it.
    const at = findApliiqInternationalZone("AT");
    expect(at).toBeDefined();
    const heavier = at!.tiers.find((t) => t.maxWeightOz === 80);
    const lighter = at!.tiers.find((t) => t.maxWeightOz === 70.4);
    expect(heavier!.rateCents).toBeLessThan(lighter!.rateCents);
  });

  it("routes a US destination to the domestic ladder", () => {
    expect(getApliiqShippingCents("us", 7.9)).toBe(596);
  });

  it("still refuses a destination outside every configured zone", () => {
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "oceania", countries: ["AU"], tiers: [{ maxWeightOz: 7.9, rateCents: 3500 }] },
    ]));
    expect(() => getApliiqInternationalShippingCents("GB", 7.9)).toThrow("No verified APLIIQ international rate zone covers GB");
  });
});

describe("international flat-rate coverage", () => {
  // The flat charge is levied ONCE PER ORDER; freight is rated on the whole
  // shipment. Every assertion below exists to keep those two units matched, and
  // to keep the answer from depending on an assumed basket size.
  const TEE_OZ = 7.9;

  /** The reviewer's reproduction ladder: covered at 1-2 units, $19 under at 4. */
  const REVIEWER_GB_ZONE = {
    zone: "eu",
    countries: ["GB"],
    tiers: [
      { maxWeightOz: 7.9, rateCents: 1500 },
      { maxWeightOz: 15.9, rateCents: 1900 },
      { maxWeightOz: 31.9, rateCents: 3900 },
    ],
  };

  it("bounds the exposure walk by the cart's real per-line quantity cap", () => {
    // lib must not import a client component, so the cap is duplicated. If
    // CartProvider raises its cap, the walk stops short of baskets a shopper
    // can now build and the ceiling silently understates the exposure.
    const cart = readFileSync(join(process.cwd(), "components", "cart", "CartProvider.tsx"), "utf8");
    const declared = /const MAX_QUANTITY_PER_ITEM = (\d+);/.exec(cart);
    expect(declared).not.toBeNull();
    expect(Number(declared![1])).toBe(FLAT_RATE_MAX_UNITS_PER_ORDER);
  });

  it("reports an unmodelled destination as unknown, never as covered", () => {
    // AQ is genuinely absent from the APLIIQ sheet.
    const coverage = checkInternationalFlatRateCoverage("AQ", { unitWeightOz: TEE_OZ, unitsPerOrder: 2 });
    expect(coverage).toMatchObject({
      countryCode: "AQ",
      modelled: false,
      exposure: "unmodelled",
      unitsPerOrder: 2,
      orderWeightOz: 15.8,
      modelledOrderFreightCents: null,
      chargedCentsPerOrder: INTERNATIONAL_SHIPPING_CENTS,
      maxUnitsPerOrder: FLAT_RATE_MAX_UNITS_PER_ORDER,
      // UNKNOWN, never 0 — 0 would read as a proven loss on a single unit.
      breakEvenUnitsPerOrder: null,
      coveredAtUnitsPerOrder: null,
    });
    expect(coverage.warnings).toHaveLength(1);
    expect(coverage.warnings[0]).toContain("international freight to AQ is not modelled");
    expect(isInternationalFlatRateUnderwater(coverage)).toBe(false);
  });

  it("prices a modelled destination and exposes the real break-even unit count", () => {
    // Canada, sourced sheet 2026-08-11: 15.8 oz = 1395c against a 2000c flat
    // charge, so this basket is covered — but the cart allows 20 per line and
    // the charge stops covering at 5 units. The exposure ceiling must be visible
    // even though this particular basket is fine.
    const coverage = checkInternationalFlatRateCoverage("CA", { unitWeightOz: TEE_OZ, unitsPerOrder: 2 });
    expect(coverage).toMatchObject({
      countryCode: "CA",
      modelled: true,
      unitsPerOrder: 2,
      orderWeightOz: 15.8,
      modelledOrderFreightCents: 1395,
      coveredAtUnitsPerOrder: true,
      breakEvenUnitsPerOrder: 4,
      exposure: "uncovered_within_cart_limit",
    });
    expect(coverage.warnings[0]).toContain("covers at most 4 unit(s) to CA");
  });

  it("flags a destination whose freight beats the flat charge on the very first unit", () => {
    // Japan, 3 tees: 4011c freight against 2000c collected. The single worst
    // international case found in the sheet at apparel weights.
    const coverage = checkInternationalFlatRateCoverage("JP", { unitWeightOz: TEE_OZ, unitsPerOrder: 3 });
    expect(coverage.modelled).toBe(true);
    expect(coverage.modelledOrderFreightCents).toBe(4011);
    expect(coverage.coveredAtUnitsPerOrder).toBe(false);
    expect(coverage.breakEvenUnitsPerOrder).toBe(1);
    expect(isInternationalFlatRateUnderwater(coverage)).toBe(true);
  });

  it("REGRESSION: reports the underwater 4-unit basket the 2-unit basis stayed silent about", () => {
    // The judge's exact reproduction. With the assumed 2-unit basis this zone
    // answered "covered: true" and produced no warning at all, while a 4-unit
    // order of the same tee cost $39 against a $20 charge.
    __setApliiqShippingRateTableForTest(fixture([REVIEWER_GB_ZONE]));

    // The optimistic answers that used to be the whole story.
    const oneUp = checkInternationalFlatRateCoverage("GB", { unitWeightOz: TEE_OZ, unitsPerOrder: 1 });
    const twoUp = checkInternationalFlatRateCoverage("GB", { unitWeightOz: TEE_OZ, unitsPerOrder: 2 });
    expect(oneUp.coveredAtUnitsPerOrder).toBe(true);
    expect(twoUp.coveredAtUnitsPerOrder).toBe(true);
    expect(twoUp.modelledOrderFreightCents).toBe(1900);

    // ...and the truth they were hiding, now reported by the very same calls.
    for (const optimistic of [oneUp, twoUp]) {
      expect(optimistic.breakEvenUnitsPerOrder).toBe(2);
      expect(optimistic.exposure).toBe("uncovered_within_cart_limit");
      expect(isInternationalFlatRateUnderwater(optimistic)).toBe(true);
      expect(optimistic.warnings).toEqual([
        "flat international charge 2000c per order covers at most 2 unit(s) to GB but the cart allows 20 per line: a 3-unit order (23.7 oz) costs 3900c",
      ]);
    }

    const fourUp = checkInternationalFlatRateCoverage("GB", { unitWeightOz: TEE_OZ, unitsPerOrder: 4 });
    expect(fourUp.orderWeightOz).toBe(31.6);
    expect(fourUp.modelledOrderFreightCents).toBe(3900);
    expect(fourUp.coveredAtUnitsPerOrder).toBe(false);
    expect(fourUp.warnings).toContain(
      "flat international charge 2000c per order does not cover modelled GB freight 3900c for a 4-unit order (31.6 oz); the charge breaks even at 2 unit(s)"
    );
  });

  it("answers the break-even ceiling without being told a basket size at all", () => {
    __setApliiqShippingRateTableForTest(fixture([REVIEWER_GB_ZONE]));
    const coverage = checkInternationalFlatRateCoverage("GB", { unitWeightOz: TEE_OZ, unitsPerOrder: null });
    expect(coverage).toMatchObject({
      modelled: true,
      exposure: "uncovered_within_cart_limit",
      breakEvenUnitsPerOrder: 2,
      // It refuses to answer "covered" when no basket was stated, rather than
      // picking one. The exposure is reported regardless.
      unitsPerOrder: null,
      orderWeightOz: null,
      modelledOrderFreightCents: null,
      coveredAtUnitsPerOrder: null,
    });
    expect(coverage.warnings).toHaveLength(1);
  });

  it("rates the ORDER weight, not one unit — the per-unit comparison called a losing order covered", () => {
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "eu", countries: ["GB"], tiers: [
        { maxWeightOz: 7.9, rateCents: 1800 },
        { maxWeightOz: 15.9, rateCents: 2600 },
        { maxWeightOz: 31.9, rateCents: 3900 },
      ] },
    ]));
    // The old per-unit basis: $20 >= $18, "covered", no warning. That is the bug.
    expect(getApliiqInternationalShippingCents("GB", TEE_OZ)).toBeLessThan(INTERNATIONAL_SHIPPING_CENTS);

    const twoUp = checkInternationalFlatRateCoverage("GB", { unitWeightOz: TEE_OZ, unitsPerOrder: 2 });
    expect(twoUp.orderWeightOz).toBe(15.8);
    expect(twoUp.modelledOrderFreightCents).toBe(2600);
    expect(twoUp.coveredAtUnitsPerOrder).toBe(false);
    expect(twoUp.breakEvenUnitsPerOrder).toBe(1);
    expect(twoUp.warnings).toEqual([
      "flat international charge 2000c per order covers at most 1 unit(s) to GB but the cart allows 20 per line: a 2-unit order (15.8 oz) costs 2600c",
      "flat international charge 2000c per order does not cover modelled GB freight 2600c for a 2-unit order (15.8 oz); the charge breaks even at 1 unit(s)",
    ]);
  });

  it("stays silent ONLY when the charge covers every basket the cart permits", () => {
    // 20 tees is 158 oz, so a ladder has to reach that far AND stay under $20
    // before this check has nothing to say.
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "north-america", countries: ["ca"], tiers: [
        { maxWeightOz: 7.9, rateCents: 500 },
        { maxWeightOz: 15.9, rateCents: 700 },
        { maxWeightOz: 159.9, rateCents: 1800 },
      ] },
    ]));
    const coverage = checkInternationalFlatRateCoverage("CA", { unitWeightOz: TEE_OZ, unitsPerOrder: 2 });
    expect(coverage).toEqual({
      countryCode: "CA",
      modelled: true,
      exposure: "covered_to_cart_limit",
      unitsPerOrder: 2,
      orderWeightOz: 15.8,
      modelledOrderFreightCents: 700,
      chargedCentsPerOrder: INTERNATIONAL_SHIPPING_CENTS,
      maxUnitsPerOrder: FLAT_RATE_MAX_UNITS_PER_ORDER,
      breakEvenUnitsPerOrder: 20,
      coveredAtUnitsPerOrder: true,
      warnings: [],
    });
    expect(isInternationalFlatRateUnderwater(coverage)).toBe(false);
  });

  it("REGRESSION: a ladder that covers the stated basket but not the cart cap is never silent", () => {
    // This is the shape the old check blessed: everything the assumed basket
    // touched was fine, so warnings came back empty while the real ceiling sat
    // four units below what a shopper could order.
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "north-america", countries: ["CA"], tiers: [
        { maxWeightOz: 7.9, rateCents: 500 },
        { maxWeightOz: 15.9, rateCents: 700 },
        { maxWeightOz: 31.9, rateCents: 900 },
        { maxWeightOz: 47.9, rateCents: 2500 },
      ] },
    ]));
    const coverage = checkInternationalFlatRateCoverage("CA", { unitWeightOz: TEE_OZ, unitsPerOrder: 2 });
    expect(coverage.coveredAtUnitsPerOrder).toBe(true);
    expect(coverage.breakEvenUnitsPerOrder).toBe(4);
    expect(coverage.exposure).toBe("uncovered_within_cart_limit");
    expect(coverage.warnings).toEqual([
      "flat international charge 2000c per order covers at most 4 unit(s) to CA but the cart allows 20 per line: a 5-unit order (39.5 oz) costs 2500c",
    ]);
  });

  it("counts an order weight past the top of the zone ladder as NOT covered, never as unknown", () => {
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "oceania", countries: ["AU"], tiers: [
        { maxWeightOz: 7.9, rateCents: 900 },
        { maxWeightOz: 15.9, rateCents: 1500 },
      ] },
    ]));
    const coverage = checkInternationalFlatRateCoverage("AU", { unitWeightOz: TEE_OZ, unitsPerOrder: 4 });
    expect(coverage.modelled).toBe(true);
    expect(coverage.orderWeightOz).toBe(31.6);
    expect(coverage.modelledOrderFreightCents).toBeNull();
    expect(coverage.coveredAtUnitsPerOrder).toBe(false);
    expect(coverage.breakEvenUnitsPerOrder).toBe(2);
    expect(coverage.exposure).toBe("uncovered_within_cart_limit");
    expect(coverage.warnings).toEqual([
      "flat international charge 2000c per order covers at most 2 unit(s) to AU but the cart allows 20 per line: a 3-unit order (23.7 oz) is past the top of the zone ladder and cannot be quoted",
      "flat international charge 2000c per order cannot cover AU freight for a 4-unit order (31.6 oz): it is past the top of the zone ladder",
    ]);
  });

  it("honours an explicit per-order charge instead of the storefront default", () => {
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "eu", countries: ["GB"], tiers: [
        { maxWeightOz: 7.9, rateCents: 1800 },
        { maxWeightOz: 15.9, rateCents: 2600 },
      ] },
    ]));
    const raised = checkInternationalFlatRateCoverage("GB", {
      unitWeightOz: TEE_OZ,
      unitsPerOrder: 2,
      chargedCentsPerOrder: 2600,
    });
    expect(raised).toMatchObject({
      chargedCentsPerOrder: 2600,
      coveredAtUnitsPerOrder: true,
      breakEvenUnitsPerOrder: 2,
    });
    // Raising the charge covers the stated basket but not a 3-unit one, which
    // runs off this ladder — so it is still not silent.
    expect(raised.exposure).toBe("uncovered_within_cart_limit");
    expect(raised.warnings).toHaveLength(1);
  });

  it("lets a caller narrow the walk to a smaller cap than the cart's", () => {
    __setApliiqShippingRateTableForTest(fixture([REVIEWER_GB_ZONE]));
    const capped = checkInternationalFlatRateCoverage("GB", {
      unitWeightOz: TEE_OZ,
      unitsPerOrder: null,
      maxUnitsPerOrder: 2,
    });
    expect(capped).toMatchObject({
      maxUnitsPerOrder: 2,
      breakEvenUnitsPerOrder: 2,
      exposure: "covered_to_cart_limit",
      warnings: [],
    });
  });

  it("normalizes the order weight back to two decimals after multiplying", () => {
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "eu", countries: ["GB"], tiers: [{ maxWeightOz: 23.7, rateCents: 1200 }] },
    ]));
    // 7.9 * 3 drifts to 23.700000000000003, which would fall off a 23.7 ceiling.
    expect(7.9 * 3).not.toBe(23.7);
    const coverage = checkInternationalFlatRateCoverage("GB", { unitWeightOz: 7.8 + 0.1, unitsPerOrder: 3 });
    expect(coverage.orderWeightOz).toBe(23.7);
    expect(coverage.modelledOrderFreightCents).toBe(1200);
    expect(coverage.coveredAtUnitsPerOrder).toBe(true);
  });

  it("REGRESSION: rates the ceiling and the stated basket on ONE rounding basis", () => {
    // 7.994 oz normalizes to 7.99, so the stated-basket path put a 2-up order at
    // 15.98 oz (on the ladder, 1200c, "covered") while the break-even walk
    // multiplied the RAW weight to 15.988 -> 15.99 oz (off the ladder, "breaks
    // even at 1 unit"). Two answers about the same order.
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "eu", countries: ["GB"], tiers: [{ maxWeightOz: 15.98, rateCents: 1200 }] },
    ]));
    const coverage = checkInternationalFlatRateCoverage("GB", { unitWeightOz: 7.994, unitsPerOrder: 2 });
    expect(coverage.orderWeightOz).toBe(15.98);
    expect(coverage.modelledOrderFreightCents).toBe(1200);
    expect(coverage.coveredAtUnitsPerOrder).toBe(true);
    expect(coverage.breakEvenUnitsPerOrder).toBe(2);
  });

  it.each([1.5, 0, -2, Number.NaN])("refuses the non-order-size %s rather than assuming one unit", (unitsPerOrder) => {
    expect(() => checkInternationalFlatRateCoverage("GB", { unitWeightOz: TEE_OZ, unitsPerOrder }))
      .toThrow("positive integer unitsPerOrder");
  });

  it.each([0, -1, 2.5, Number.NaN])("refuses the non-cap %s for the exposure walk", (maxUnitsPerOrder) => {
    expect(() => checkInternationalFlatRateCoverage("GB", {
      unitWeightOz: TEE_OZ,
      unitsPerOrder: null,
      maxUnitsPerOrder,
    })).toThrow("positive integer maxUnitsPerOrder");
  });

  it("reports an unusable unit weight as unpriceable rather than covered", () => {
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "eu", countries: ["GB"], tiers: [{ maxWeightOz: 15.9, rateCents: 1200 }] },
    ]));
    const coverage = checkInternationalFlatRateCoverage("GB", { unitWeightOz: 0, unitsPerOrder: 2 });
    expect(coverage).toMatchObject({
      modelled: false,
      exposure: "unpriceable",
      orderWeightOz: null,
      modelledOrderFreightCents: null,
      breakEvenUnitsPerOrder: null,
      coveredAtUnitsPerOrder: null,
    });
    expect(coverage.warnings).toHaveLength(1);
    expect(coverage.warnings[0]).toContain("cannot be priced");
    expect(isInternationalFlatRateUnderwater(coverage)).toBe(false);
  });

  it("reports zero break-even when the flat charge is underwater on a single unit", () => {
    __setApliiqShippingRateTableForTest(fixture([
      { zone: "oceania", countries: ["AU"], tiers: [{ maxWeightOz: 31.9, rateCents: 3500 }] },
    ]));
    const coverage = checkInternationalFlatRateCoverage("AU", { unitWeightOz: TEE_OZ, unitsPerOrder: 2 });
    expect(coverage.coveredAtUnitsPerOrder).toBe(false);
    expect(coverage.modelledOrderFreightCents).toBe(3500);
    expect(coverage.breakEvenUnitsPerOrder).toBe(0);
    expect(coverage.exposure).toBe("uncovered_at_one_unit");
    expect(isInternationalFlatRateUnderwater(coverage)).toBe(true);
    expect(coverage.warnings[0]).toBe(
      "flat international charge 2000c per order covers 0 units to AU: a 1-unit order (7.9 oz) costs 3500c"
    );
  });

  // The invariants the whole redesign rests on. If any of these break, a
  // basket can be underwater and reported as fine again.
  describe("coverage invariants across every reachable basket", () => {
    const LADDERS: ReadonlyArray<readonly [string, ReadonlyArray<{ maxWeightOz: number; rateCents: number }>]> = [
      ["underwater at one unit", [{ maxWeightOz: 320, rateCents: 3500 }]],
      ["tips mid-cart", [
        { maxWeightOz: 7.9, rateCents: 1500 },
        { maxWeightOz: 15.9, rateCents: 1900 },
        { maxWeightOz: 31.9, rateCents: 3900 },
        { maxWeightOz: 320, rateCents: 5900 },
      ]],
      ["runs off the ladder", [
        { maxWeightOz: 7.9, rateCents: 900 },
        { maxWeightOz: 15.9, rateCents: 1500 },
      ]],
      ["covers the whole cart", [
        { maxWeightOz: 7.9, rateCents: 500 },
        { maxWeightOz: 159.9, rateCents: 1800 },
      ]],
      ["flat right at the charge", [{ maxWeightOz: 320, rateCents: INTERNATIONAL_SHIPPING_CENTS }]],
    ];
    const UNIT_WEIGHTS = [0.5, 7.9, 7.994, 7.8 + 0.1, 16];

    it.each(LADDERS.map(([label, tiers]) => [label, tiers] as const))(
      "%s: covered is exactly 'at or below the break-even', for every basket 1..20",
      (_label, tiers) => {
        for (const unitWeightOz of UNIT_WEIGHTS) {
          __setApliiqShippingRateTableForTest(fixture([{ zone: "z", countries: ["GB"], tiers: [...tiers] }]));
          const ceiling = checkInternationalFlatRateCoverage("GB", { unitWeightOz, unitsPerOrder: null });
          expect(ceiling.breakEvenUnitsPerOrder).not.toBeNull();
          const breakEven = ceiling.breakEvenUnitsPerOrder!;

          for (let units = 1; units <= FLAT_RATE_MAX_UNITS_PER_ORDER; units += 1) {
            const at = checkInternationalFlatRateCoverage("GB", { unitWeightOz, unitsPerOrder: units });
            // 1. covered and the ceiling can never disagree.
            expect(at.coveredAtUnitsPerOrder).toBe(units <= breakEven);
            // 2. the ceiling does not move with the basket the caller asks about.
            expect(at.breakEvenUnitsPerOrder).toBe(breakEven);
            expect(at.exposure).toBe(ceiling.exposure);
            // 3. THE POINT: silence is impossible while any reachable basket is
            //    underwater, however comfortable the stated basket looks.
            if (breakEven < FLAT_RATE_MAX_UNITS_PER_ORDER) {
              expect(at.warnings.length).toBeGreaterThan(0);
              expect(isInternationalFlatRateUnderwater(at)).toBe(true);
            } else {
              expect(at.warnings).toEqual([]);
              expect(at.coveredAtUnitsPerOrder).toBe(true);
            }
            // 4. a covered basket is priced at or below the charge; an
            //    uncovered one is priced above it or not priceable at all.
            if (at.coveredAtUnitsPerOrder) {
              expect(at.modelledOrderFreightCents).not.toBeNull();
              expect(at.modelledOrderFreightCents!).toBeLessThanOrEqual(at.chargedCentsPerOrder);
            } else if (at.modelledOrderFreightCents !== null) {
              expect(at.modelledOrderFreightCents).toBeGreaterThan(at.chargedCentsPerOrder);
            }
          }
        }
      }
    );
  });
});


describe("rate table parsing", () => {
  it("rejects a tier table that is not strictly increasing in weight", () => {
    expect(() => parseApliiqShippingRateTable({
      ...(fixture([]) as Record<string, unknown>),
      domestic: { destinationCountry: "US", service: "standard", tiers: [
        { maxWeightOz: 11.9, rateCents: 692 },
        { maxWeightOz: 7.9, rateCents: 596 },
      ] },
    })).toThrow("strictly greater than the previous tier ceiling");
  });

  it("rejects a heavier tier that is cheaper than a lighter one", () => {
    expect(() => parseApliiqShippingRateTable({
      ...(fixture([]) as Record<string, unknown>),
      domestic: { destinationCountry: "US", service: "standard", tiers: [
        { maxWeightOz: 7.9, rateCents: 692 },
        { maxWeightOz: 11.9, rateCents: 596 },
      ] },
    })).toThrow("must not be cheaper than a lighter tier");
  });

  it("rejects a country claimed by two zones, which would make lookup order-dependent", () => {
    expect(() => parseApliiqShippingRateTable(fixture([
      { zone: "a", countries: ["CA"], tiers: [{ maxWeightOz: 7.9, rateCents: 100 }] },
      { zone: "b", countries: ["CA"], tiers: [{ maxWeightOz: 7.9, rateCents: 200 }] },
    ]))).toThrow("duplicates CA from an earlier zone");
  });

  it.each([
    ["fractional cents", { maxWeightOz: 7.9, rateCents: 5.96 }, "positive integer number of cents"],
    ["zero rate", { maxWeightOz: 7.9, rateCents: 0 }, "positive integer number of cents"],
    ["zero ceiling", { maxWeightOz: 0, rateCents: 596 }, "finite positive number"],
  ])("rejects a tier with %s", (_label, tier, expected) => {
    expect(() => parseApliiqShippingRateTable({
      ...(fixture([]) as Record<string, unknown>),
      domestic: { destinationCountry: "US", service: "standard", tiers: [tier] },
    })).toThrow(expected);
  });

  it("rejects an empty tier list rather than treating it as free shipping", () => {
    expect(() => parseApliiqShippingRateTable({
      ...(fixture([]) as Record<string, unknown>),
      domestic: { destinationCountry: "US", service: "standard", tiers: [] },
    })).toThrow("must be a nonempty tier array");
  });
});
