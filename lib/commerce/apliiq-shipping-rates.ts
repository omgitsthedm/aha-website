// APLIIQ freight is billed SEPARATELY from product cost, by weight tier and
// destination. This module owns the committed rate ladder in
// data/apliiq-shipping-rates.json and the only lookup allowed to read it.
//
// Two rules the rest of the codebase depends on:
//  1. Tier steps are IRREGULAR (7.9, 11.9, 15.9, 31.9 … 143.99, 159.84). Never
//     assume a uniform step and never interpolate.
//  2. A weight past the last published tier is an ERROR, never a clamp to the
//     last row. Silently clamping would understate freight and bless an
//     underwater SKU, which is the exact bug this engine exists to prevent.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INTERNATIONAL_SHIPPING_CENTS } from "@/lib/commerce/policies";

const RATES_FILE = join(process.cwd(), "data", "apliiq-shipping-rates.json");

export interface ApliiqShippingTier {
  /** Inclusive upper bound of the tier, in ounces. */
  maxWeightOz: number;
  rateCents: number;
}

export interface ApliiqInternationalZone {
  zone: string;
  /** Uppercase ISO alpha-2 destinations served by this zone. */
  countries: string[];
  tiers: ApliiqShippingTier[];
}

export interface ApliiqShippingRateTable {
  schemaVersion: number;
  effectiveDate: string;
  currency: string;
  /** $1.00 per PRODUCT (per unit), not per order. */
  fulfillmentFeeCentsPerUnit: number;
  domestic: { destinationCountry: string; service: string; tiers: ApliiqShippingTier[] };
  international: { zones: ApliiqInternationalZone[] };
}

export type ApliiqShippingRateErrorKind =
  | "invalid_weight"
  | "over_max_weight"
  | "unmodelled_destination";

export class ApliiqShippingRateError extends Error {
  constructor(readonly kind: ApliiqShippingRateErrorKind, message: string) {
    super(message);
    this.name = "ApliiqShippingRateError";
  }
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid data/apliiq-shipping-rates.json at ${path}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(path, "must be a finite positive number");
  }
  return value;
}

function positiveIntegerCents(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    fail(path, "must be a positive integer number of cents");
  }
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "must be a nonempty string");
  return value.trim();
}

/**
 * A tier table must be strictly increasing in WEIGHT — the "first tier at or
 * above the weight" search depends on it, and a table that breaks it would
 * return an arbitrary row.
 *
 * Price is a different matter. APLIIQ's international rates are NOT monotonic in
 * weight: in 31 of 213 destinations a heavier tier is CHEAPER because a different
 * carrier service takes over at a weight break (Austria 70.4oz = $74.84 then
 * 80.0oz = $56.05; Brazil breaks at 80oz and again at 1072oz). Verified against
 * the merchant-supplied 2026-08-11 rate sheet. Rejecting those would discard real
 * pricing, so `allowServiceBreaks` opts international out of the price check.
 *
 * The domestic US ladder IS monotonic and stays strict — a cheaper-heavier US
 * tier really would indicate a corrupt table.
 *
 * Consequence for anything estimating a WORST CASE across a weight RANGE: you
 * must take the max rate over the tiers spanned, not the rate at the heaviest
 * point, because the heaviest point can be cheaper than one in the middle. Use
 * `maxTierRateUpToWeight`.
 */
function parseTiers(
  value: unknown,
  path: string,
  options: { allowServiceBreaks?: boolean } = {}
): ApliiqShippingTier[] {
  if (!Array.isArray(value) || value.length === 0) fail(path, "must be a nonempty tier array");
  const tiers = value.map((entry, index) => {
    const tierPath = `${path}[${index}]`;
    if (!isRecord(entry)) fail(tierPath, "must be an object");
    return {
      maxWeightOz: positiveNumber(entry.maxWeightOz, `${tierPath}.maxWeightOz`),
      rateCents: positiveIntegerCents(entry.rateCents, `${tierPath}.rateCents`),
    };
  });
  for (let index = 1; index < tiers.length; index += 1) {
    if (tiers[index].maxWeightOz <= tiers[index - 1].maxWeightOz) {
      fail(`${path}[${index}].maxWeightOz`, "must be strictly greater than the previous tier ceiling");
    }
    if (!options.allowServiceBreaks && tiers[index].rateCents < tiers[index - 1].rateCents) {
      fail(`${path}[${index}].rateCents`, "must not be cheaper than a lighter tier");
    }
  }
  return tiers;
}

/** Pure structural parser. Exported so a fixture can be validated the same way. */
export function parseApliiqShippingRateTable(value: unknown): ApliiqShippingRateTable {
  if (!isRecord(value)) fail("$", "document must be an object");
  const billing = isRecord(value.billing) ? value.billing : fail("$.billing", "must be an object");
  const domestic = isRecord(value.domestic) ? value.domestic : fail("$.domestic", "must be an object");
  const international = isRecord(value.international)
    ? value.international
    : fail("$.international", "must be an object");
  if (!Array.isArray(international.zones)) fail("$.international.zones", "must be an array (empty until verified)");

  const seenCountries = new Set<string>();
  const zones = international.zones.map((entry, index) => {
    const zonePath = `$.international.zones[${index}]`;
    if (!isRecord(entry)) fail(zonePath, "must be an object");
    if (!Array.isArray(entry.countries) || entry.countries.length === 0) {
      fail(`${zonePath}.countries`, "must be a nonempty country array");
    }
    const countries = entry.countries.map((country, countryIndex) => {
      const code = nonEmptyString(country, `${zonePath}.countries[${countryIndex}]`).toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) fail(`${zonePath}.countries[${countryIndex}]`, "must be an ISO alpha-2 code");
      // One country in two zones makes the lookup order-dependent, which would
      // silently pick whichever zone was listed first.
      if (seenCountries.has(code)) fail(`${zonePath}.countries[${countryIndex}]`, `duplicates ${code} from an earlier zone`);
      seenCountries.add(code);
      return code;
    });
    return {
      zone: nonEmptyString(entry.zone, `${zonePath}.zone`),
      countries,
      // International only: real carrier service breaks make heavier cheaper.
      tiers: parseTiers(entry.tiers, `${zonePath}.tiers`, { allowServiceBreaks: true }),
    };
  });

  return {
    schemaVersion: positiveNumber(value.schemaVersion, "$.schemaVersion"),
    effectiveDate: nonEmptyString(value.effectiveDate, "$.effectiveDate"),
    currency: nonEmptyString(value.currency, "$.currency"),
    fulfillmentFeeCentsPerUnit: positiveIntegerCents(
      billing.fulfillmentFeeCentsPerUnit,
      "$.billing.fulfillmentFeeCentsPerUnit"
    ),
    domestic: {
      destinationCountry: nonEmptyString(domestic.destinationCountry, "$.domestic.destinationCountry").toUpperCase(),
      service: nonEmptyString(domestic.service, "$.domestic.service"),
      tiers: parseTiers(domestic.tiers, "$.domestic.tiers"),
    },
    international: { zones },
  };
}

let cached: ApliiqShippingRateTable | undefined;

/** Parse-once accessor for the committed rate ladder. */
export function loadApliiqShippingRates(): ApliiqShippingRateTable {
  cached ??= parseApliiqShippingRateTable(JSON.parse(readFileSync(RATES_FILE, "utf8")) as unknown);
  return cached;
}

/**
 * Test seam. The committed international zone list is deliberately empty — no
 * verified APLIIQ international rates exist — so the zone lookup and flat-rate
 * coverage branches have no production data to exercise. A fixture passed here
 * goes through the same parser as the committed file; pass undefined to restore
 * the committed table.
 */
export function __setApliiqShippingRateTableForTest(value: unknown): void {
  cached = value === undefined ? undefined : parseApliiqShippingRateTable(value);
}

/** APLIIQ's per-PRODUCT fulfillment fee, sourced from the committed rate sheet. */
export function getApliiqFulfillmentFeeCentsPerUnit(): number {
  return loadApliiqShippingRates().fulfillmentFeeCentsPerUnit;
}

/**
 * Shipped weight is persisted as numeric(8,2), so the lookup normalizes to two
 * decimals before comparing. Without this a weight that arrived through
 * floating-point arithmetic (7.9000000000000004) would fall into the next tier
 * up and overstate freight.
 */
function normalizeWeightOz(weightOz: number): number {
  if (typeof weightOz !== "number" || !Number.isFinite(weightOz) || weightOz <= 0) {
    throw new ApliiqShippingRateError(
      "invalid_weight",
      `APLIIQ freight lookup requires a positive shipped weight in ounces (received ${String(weightOz)}).`
    );
  }
  return Math.round(weightOz * 100) / 100;
}

/**
 * Binary search for the first tier whose ceiling is at or above the weight.
 * Over-max throws — see the module header for why clamping is forbidden.
 */
export function lookupTierRateCents(
  tiers: readonly ApliiqShippingTier[],
  weightOz: number,
  label = "APLIIQ"
): number {
  const weight = normalizeWeightOz(weightOz);
  let low = 0;
  let high = tiers.length - 1;
  let match = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (tiers[mid].maxWeightOz >= weight) {
      match = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  if (match === -1) {
    const ceiling = tiers[tiers.length - 1].maxWeightOz;
    throw new ApliiqShippingRateError(
      "over_max_weight",
      `${label} publishes no shipping rate above ${ceiling} oz; ${weight} oz must be quoted manually.`
    );
  }
  return tiers[match].rateCents;
}

/**
 * Conservative single-unit US freight for one variant. The margin gate uses
 * this rather than an amortised per-order figure: a multi-item order always
 * spreads freight better, so gating on the single-unit rate can never bless an
 * underwater SKU.
 */
export function getApliiqDomesticShippingCents(weightOz: number): number {
  const table = loadApliiqShippingRates();
  return lookupTierRateCents(table.domestic.tiers, weightOz, `APLIIQ ${table.domestic.destinationCountry} standard`);
}

export function findApliiqInternationalZone(countryCode: string): ApliiqInternationalZone | undefined {
  const code = countryCode.trim().toUpperCase();
  return loadApliiqShippingRates().international.zones.find((zone) => zone.countries.includes(code));
}

/**
 * International freight for a destination. Throws `unmodelled_destination`
 * while the zone table is empty — the rate sheet deliberately ships with no
 * invented international numbers.
 */
export function getApliiqInternationalShippingCents(countryCode: string, weightOz: number): number {
  const zone = findApliiqInternationalZone(countryCode);
  if (!zone) {
    throw new ApliiqShippingRateError(
      "unmodelled_destination",
      `No verified APLIIQ international rate zone covers ${countryCode.trim().toUpperCase()}; populate data/apliiq-shipping-rates.json international.zones before selling there.`
    );
  }
  return lookupTierRateCents(zone.tiers, weightOz, `APLIIQ international zone ${zone.zone}`);
}

/** Domestic or international freight, chosen by destination. */
export function getApliiqShippingCents(countryCode: string, weightOz: number): number {
  const table = loadApliiqShippingRates();
  const code = countryCode.trim().toUpperCase();
  return code === table.domestic.destinationCountry
    ? getApliiqDomesticShippingCents(weightOz)
    : getApliiqInternationalShippingCents(code, weightOz);
}

// ---------------------------------------------------------------------------
// International flat-rate coverage
//
// DIMENSIONS, stated once so they can never be mixed again. The flat
// international charge is levied ONCE PER ORDER — lib/square/orders.ts adds a
// single TOTAL_PHASE service charge of INTERNATIONAL_SHIPPING_CENTS to the
// order, not to each line. Every rate in the ladder, by contrast, prices the
// weight of a WHOLE SHIPMENT. So the only honest coverage test weighs a
// per-ORDER charge against per-ORDER freight.
//
// Comparing the per-order charge against ONE unit's freight is not a
// conservative shortcut, it is the optimistic direction: a heavier order costs
// more to ship while the charge stays at $20, so the single-unit comparison
// understates the loss on exactly the multi-unit orders the flat rate is most
// exposed to. (The single-unit basis IS conservative for the domestic margin
// gate above, because there both sides — freight and retail revenue — are
// per unit. That symmetry does not exist here.)
//
// AND THE SAME ARGUMENT DEFEATS EVERY OTHER FIXED BASKET SIZE. Rating the check
// at 2 units instead of 1 only moves the blind spot one notch: with a GB zone
// of 7.9oz->$15 / 15.9oz->$19 / 31.9oz->$39, a 2-unit order is covered and
// reports nothing while a 4-unit order of the same variant is $19 underwater.
// Coverage is not a property of an assumed basket. It is a CURVE — freight
// climbs with order weight while the charge stays flat — so the honest primary
// result is the BREAK-EVEN UNIT COUNT: the largest basket the charge covers.
//
// Therefore:
//  * `breakEvenUnitsPerOrder` is the first-class result. It is computed
//    whenever the destination can be priced at all, and never discarded.
//  * `coveredAtUnitsPerOrder` is DERIVED from the break-even, and is null
//    unless the caller states a basket size. This function will not invent one.
//  * `warnings` is empty ONLY when the charge covers every basket a shopper can
//    physically build. Any reachable basket it cannot cover produces a warning
//    even when the caller's own basket is fine, so a genuinely underwater SKU
//    can never come back silent.
//
// Every field and parameter below carries its basis in its name.
// ---------------------------------------------------------------------------

/**
 * The heaviest single-variant order the flat charge can ever be asked to cover.
 * Mirrors MAX_QUANTITY_PER_ITEM in components/cart/CartProvider.tsx (20): the
 * largest quantity of one variant a shopper can actually put in the cart.
 *
 * This is a FACT ABOUT THE STOREFRONT, not an assumed basket size — which is
 * exactly why the exposure ceiling below can be reported without assuming
 * anything about what people buy. Duplicated as a local constant on purpose:
 * lib must not import a client component. tests/unit/apliiq-shipping-rates.test.ts
 * reads CartProvider.tsx and pins the two numbers together.
 */
export const FLAT_RATE_MAX_UNITS_PER_ORDER = 20;

/**
 * What the flat charge is exposed to at this destination. `unmodelled` and
 * `unpriceable` are UNKNOWNS; the two `uncovered_*` states are proven losses.
 * A gate that fails the build should fail on the latter, never the former.
 */
export type InternationalFlatRateExposure =
  /** The unit weight itself is unusable, so nothing can be rated. */
  | "unpriceable"
  /** No verified rate zone covers the destination. Unknown, not zero. */
  | "unmodelled"
  /** The charge is underwater on a single unit. */
  | "uncovered_at_one_unit"
  /** Covers some baskets, but not every basket the cart permits. */
  | "uncovered_within_cart_limit"
  /** Covers every basket a shopper can physically build. The only silent state. */
  | "covered_to_cart_limit";

export interface InternationalFlatRateCoverageInput {
  /** Shipped weight of ONE unit, in ounces. */
  unitWeightOz: number;
  /**
   * A basket size to additionally answer `coveredAtUnitsPerOrder` for, or
   * `null` to decline the question.
   *
   * Required and nullable rather than optional on purpose: an omitted basket
   * size silently becomes a default, and every default is the optimistic
   * direction. `null` is an explicit "do not answer that" — the exposure
   * ceiling is reported either way, so declining costs the caller no safety.
   */
  unitsPerOrder: number | null;
  /** The flat charge, levied once per ORDER. */
  chargedCentsPerOrder?: number;
  /** Cart per-line quantity cap. Defaults to FLAT_RATE_MAX_UNITS_PER_ORDER. */
  maxUnitsPerOrder?: number;
}

export interface InternationalFlatRateCoverage {
  countryCode: string;
  /** False while no verified zone covers the destination. */
  modelled: boolean;
  /** The flat charge being tested, per ORDER. */
  chargedCentsPerOrder: number;
  /** Heaviest basket considered — the cart's per-line cap unless overridden. */
  maxUnitsPerOrder: number;
  /**
   * Largest unit count whose whole-order freight the flat charge still covers,
   * walked from 1 to maxUnitsPerOrder. 0 means the charge is underwater on a
   * single unit. null means nothing could be priced (no zone, or an unusable
   * unit weight) — which is UNKNOWN, and must never be read as zero.
   */
  breakEvenUnitsPerOrder: number | null;
  /** The single field a caller has to branch on. See the type. */
  exposure: InternationalFlatRateExposure;
  /** The basket the caller asked about, or null when it stated none. */
  unitsPerOrder: number | null;
  /** unitWeightOz x unitsPerOrder; null when no basket was stated. */
  orderWeightOz: number | null;
  /** Zone freight for that whole order; null when it cannot be priced. */
  modelledOrderFreightCents: number | null;
  /**
   * DERIVED from breakEvenUnitsPerOrder, never a second independent
   * comparison, so the two can no longer contradict each other. Null when the
   * caller stated no basket, or when nothing could be priced.
   */
  coveredAtUnitsPerOrder: boolean | null;
  /**
   * Every coverage problem found, most important first. EMPTY ONLY when
   * exposure is "covered_to_cart_limit".
   *
   * A list rather than the single `warning` string this used to expose: one
   * optional string invited a consumer to keep it and drop the rest of the
   * result, which is precisely how a $19-underwater basket went silent.
   */
  warnings: string[];
}

/**
 * THE single order-weight basis. Both the break-even walk and the caller's
 * stated basket go through this one function, so they can never again be
 * computed on different rounding. They used to be: the walk multiplied the RAW
 * unit weight while the stated basket multiplied the NORMALIZED one, which for
 * a 7.994 oz unit put a 2-unit order at 15.99 oz on one path and 15.98 oz on
 * the other — opposite sides of a tier ceiling, reporting "covered: true" and
 * "breaks even at 1 unit" about the same order.
 */
function orderWeightOzFor(normalizedUnitWeightOz: number, unitsPerOrder: number): number {
  return normalizeWeightOz(normalizedUnitWeightOz * unitsPerOrder);
}

/** The first basket size the flat charge fails to cover, and why. */
interface UncoveredPoint {
  unitsPerOrder: number;
  /** null when the order weight itself is not a usable number. */
  orderWeightOz: number | null;
  /** null when the order weight is past the top of the zone ladder. */
  freightCents: number | null;
}

type BreakEvenProbe =
  | { unmodelled: true; message: string }
  | { unmodelled: false; breakEvenUnitsPerOrder: number; firstUncovered: UncoveredPoint | null };

/**
 * Largest unit count (0..limit) whose whole-order freight the flat charge still
 * covers. Tier prices are non-decreasing in weight (enforced by parseTiers) and
 * order weight is non-decreasing in units, so freight is non-decreasing in
 * units: the first uncovered count is the break-even point and the walk can
 * stop there. An over-max order weight stops it too — nothing heavier can be
 * cheaper, and an unquotable shipment is certainly not covered.
 *
 * That monotonicity is what lets `coveredAtUnitsPerOrder` be derived from this
 * number instead of recomputed.
 */
function probeBreakEvenUnitsPerOrder(
  countryCode: string,
  normalizedUnitWeightOz: number,
  chargedCentsPerOrder: number,
  limit: number
): BreakEvenProbe {
  let breakEvenUnitsPerOrder = 0;
  for (let units = 1; units <= limit; units += 1) {
    let orderWeightOz: number | null = null;
    let freightCents: number;
    try {
      orderWeightOz = orderWeightOzFor(normalizedUnitWeightOz, units);
      freightCents = getApliiqInternationalShippingCents(countryCode, orderWeightOz);
    } catch (error) {
      if (!(error instanceof ApliiqShippingRateError)) throw error;
      // No zone at all is an UNKNOWN about the destination, not a fact about
      // this basket, and it cannot change as units grow — abandon the walk
      // rather than reporting a break-even of 0, which would read as a proven
      // loss on a single unit.
      if (error.kind === "unmodelled_destination") return { unmodelled: true, message: error.message };
      // over_max_weight, or an order weight that overflowed out of the range
      // normalizeWeightOz accepts. Either way this shipment cannot be quoted
      // from the ladder, so the charge demonstrably does not cover it.
      return {
        unmodelled: false,
        breakEvenUnitsPerOrder,
        firstUncovered: { unitsPerOrder: units, orderWeightOz, freightCents: null },
      };
    }
    if (freightCents > chargedCentsPerOrder) {
      return {
        unmodelled: false,
        breakEvenUnitsPerOrder,
        firstUncovered: { unitsPerOrder: units, orderWeightOz, freightCents },
      };
    }
    breakEvenUnitsPerOrder = units;
  }
  return { unmodelled: false, breakEvenUnitsPerOrder, firstUncovered: null };
}

function describeUncovered(point: UncoveredPoint): string {
  const weight = point.orderWeightOz === null ? "an unquotable weight" : `${point.orderWeightOz} oz`;
  return point.freightCents === null
    ? `a ${point.unitsPerOrder}-unit order (${weight}) is past the top of the zone ladder and cannot be quoted`
    : `a ${point.unitsPerOrder}-unit order (${weight}) costs ${point.freightCents}c`;
}

/**
 * International stays DDU (the customer pays duties on delivery) and the
 * storefront keeps its flat per-order charge. This reports how far up the
 * basket ladder that charge actually reaches for one variant shipped to one
 * destination, and warns whenever a basket the cart permits would run past it —
 * or when the destination has no verified zone at all, which is today's state.
 */
export function checkInternationalFlatRateCoverage(
  countryCode: string,
  input: InternationalFlatRateCoverageInput
): InternationalFlatRateCoverage {
  const code = countryCode.trim().toUpperCase();
  const { unitsPerOrder } = input;
  const chargedCentsPerOrder = input.chargedCentsPerOrder ?? INTERNATIONAL_SHIPPING_CENTS;
  const maxUnitsPerOrder = input.maxUnitsPerOrder ?? FLAT_RATE_MAX_UNITS_PER_ORDER;

  if (!Number.isInteger(maxUnitsPerOrder) || maxUnitsPerOrder < 1) {
    throw new Error(
      `checkInternationalFlatRateCoverage needs a positive integer maxUnitsPerOrder to bound the exposure walk (received ${String(maxUnitsPerOrder)}).`
    );
  }
  if (unitsPerOrder !== null && (!Number.isInteger(unitsPerOrder) || unitsPerOrder < 1)) {
    // A caller bug, not a data condition. Pass a real basket size or pass null;
    // quietly defaulting to 1 — or to any other fixed number — is the
    // optimistic comparison this signature exists to prevent.
    throw new Error(
      `checkInternationalFlatRateCoverage needs a positive integer unitsPerOrder, or an explicit null to report the break-even ceiling only (received ${String(unitsPerOrder)}).`
    );
  }

  const base = { countryCode: code, chargedCentsPerOrder, maxUnitsPerOrder, unitsPerOrder };

  // 1. The unit weight has to be usable before anything at all can be rated.
  let normalizedUnitWeightOz: number;
  try {
    normalizedUnitWeightOz = normalizeWeightOz(input.unitWeightOz);
  } catch (error) {
    if (!(error instanceof ApliiqShippingRateError)) throw error;
    return {
      ...base,
      modelled: false,
      breakEvenUnitsPerOrder: null,
      exposure: "unpriceable",
      orderWeightOz: null,
      modelledOrderFreightCents: null,
      coveredAtUnitsPerOrder: null,
      warnings: [`international freight to ${code} cannot be priced (${error.message})`],
    };
  }

  // 2. Walk the basket ladder. This is the primary result and runs before the
  //    caller's own basket, because it is the answer that cannot be optimistic.
  const probeLimit = Math.max(maxUnitsPerOrder, unitsPerOrder ?? 1);
  const probe = probeBreakEvenUnitsPerOrder(code, normalizedUnitWeightOz, chargedCentsPerOrder, probeLimit);
  if (probe.unmodelled) {
    return {
      ...base,
      modelled: false,
      breakEvenUnitsPerOrder: null,
      exposure: "unmodelled",
      orderWeightOz: unitsPerOrder === null ? null : orderWeightOzFor(normalizedUnitWeightOz, unitsPerOrder),
      modelledOrderFreightCents: null,
      coveredAtUnitsPerOrder: null,
      warnings: [`international freight to ${code} is not modelled (${probe.message})`],
    };
  }

  const { breakEvenUnitsPerOrder, firstUncovered } = probe;
  const warnings: string[] = [];

  // 3. The exposure ceiling, reported whether or not a basket was stated and
  //    whether or not that basket is covered. This is the line that makes a
  //    silent underwater SKU impossible.
  let exposure: InternationalFlatRateExposure;
  if (breakEvenUnitsPerOrder >= maxUnitsPerOrder) {
    exposure = "covered_to_cart_limit";
  } else if (breakEvenUnitsPerOrder === 0) {
    exposure = "uncovered_at_one_unit";
    warnings.push(
      `flat international charge ${chargedCentsPerOrder}c per order covers 0 units to ${code}: ${describeUncovered(firstUncovered!)}`
    );
  } else {
    exposure = "uncovered_within_cart_limit";
    warnings.push(
      `flat international charge ${chargedCentsPerOrder}c per order covers at most ${breakEvenUnitsPerOrder} unit(s) to ${code} but the cart allows ${maxUnitsPerOrder} per line: ${describeUncovered(firstUncovered!)}`
    );
  }

  // 4. Only now, and only if asked, the caller's own basket.
  let orderWeightOz: number | null = null;
  let modelledOrderFreightCents: number | null = null;
  let coveredAtUnitsPerOrder: boolean | null = null;
  if (unitsPerOrder !== null) {
    // Derived, not recomputed: freight is non-decreasing in units, so "covered
    // at n" holds exactly when n is at or below the break-even count. The walk
    // ran to at least unitsPerOrder (probeLimit), so this is always answerable.
    coveredAtUnitsPerOrder = unitsPerOrder <= breakEvenUnitsPerOrder;
    try {
      orderWeightOz = orderWeightOzFor(normalizedUnitWeightOz, unitsPerOrder);
      modelledOrderFreightCents = getApliiqInternationalShippingCents(code, orderWeightOz);
    } catch (error) {
      if (!(error instanceof ApliiqShippingRateError)) throw error;
      // Past the top of the ladder: unquotable, and certainly above the last
      // published rate. covered stays false, never null.
      modelledOrderFreightCents = null;
    }
    if (!coveredAtUnitsPerOrder) {
      warnings.push(
        modelledOrderFreightCents === null
          ? `flat international charge ${chargedCentsPerOrder}c per order cannot cover ${code} freight for a ${unitsPerOrder}-unit order (${orderWeightOz === null ? "an unquotable weight" : `${orderWeightOz} oz`}): it is past the top of the zone ladder`
          : `flat international charge ${chargedCentsPerOrder}c per order does not cover modelled ${code} freight ${modelledOrderFreightCents}c for a ${unitsPerOrder}-unit order (${orderWeightOz} oz); the charge breaks even at ${breakEvenUnitsPerOrder} unit(s)`
      );
    }
  }

  return {
    ...base,
    modelled: true,
    breakEvenUnitsPerOrder,
    exposure,
    orderWeightOz,
    modelledOrderFreightCents,
    coveredAtUnitsPerOrder,
    warnings,
  };
}

/**
 * True when this destination has a basket a shopper can actually build that the
 * flat charge does not cover — a PROVEN, quantified loss.
 *
 * Deliberately false for `unmodelled` and `unpriceable`: those are missing
 * rates, not demonstrated losses, and a build gate that conflates the two would
 * fail on every destination while the zone table is still empty.
 */
export function isInternationalFlatRateUnderwater(coverage: InternationalFlatRateCoverage): boolean {
  return coverage.exposure === "uncovered_at_one_unit" || coverage.exposure === "uncovered_within_cart_limit";
}
