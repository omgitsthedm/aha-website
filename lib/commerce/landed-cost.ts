// Variant-level landed cost for APLIIQ. This is the single place that resolves
// a variant's cost terms (item + conservative freight + per-unit fulfillment fee
// + destination tax) and hands them to calculateLandedContributionMargin.
//
// Every margin gate calls this: lib/data/purchasable.ts (runtime + build),
// scripts/margin-check.ts and scripts/enforce-margin-policy.ts.
//
// Fail-closed by design. A missing weight, a missing item cost, or a weight past
// the published rate ladder returns reasons — never a zero-freight "pass".

import type { AhaVariant } from "@/lib/types/product";
import {
  ApliiqShippingRateError,
  checkInternationalFlatRateCoverage,
  getApliiqDomesticShippingCents,
  getApliiqFulfillmentFeeCentsPerUnit,
  isInternationalFlatRateUnderwater,
  type InternationalFlatRateCoverage,
} from "@/lib/commerce/apliiq-shipping-rates";
import {
  calculateLandedContributionMargin,
  modelDestinationTaxCents,
  type LandedMarginResult,
} from "@/lib/commerce/margin";
import { DOMESTIC_COUNTRY } from "@/lib/commerce/policies";

/** The only variant fields the landed-cost engine reads. */
export type LandedCostVariant = Pick<AhaVariant,
  | "retailPrice"
  | "costEstimate"
  | "apliiqItemCost"
  | "apliiqShippingCost"
  | "apliiqFulfillmentFeeCents"
  | "apliiqDestinationTaxCents"
  | "apliiqRegionAvailability"
  | "weightOz"
>;

export interface ResolvedLandedCost {
  itemCostCents: number;
  /** Conservative single-unit US freight for this variant's weight. */
  freightCents: number;
  fulfillmentFeeCents: number;
  destinationTaxCents: number;
  margin: LandedMarginResult;
  /**
   * Human-readable modelling gaps and proven flat-rate losses, flattened from
   * `internationalCoverage` below. A superset, kept for existing reporters.
   */
  warnings: string[];
  /**
   * The WHOLE coverage result for every international destination this variant
   * is offered in — break-even ceiling, exposure state and all.
   *
   * Kept whole on purpose. The previous version of this module called the
   * coverage check and then retained only its warning string, so the
   * break-even ceiling it had just computed was thrown away and a basket that
   * was $19 underwater came back as an empty warning list.
   */
  internationalCoverage: InternationalFlatRateCoverage[];
  /**
   * Destinations where the flat per-order charge is PROVEN not to cover a
   * basket a shopper can actually build. Non-empty means a quantified loss, as
   * distinct from an unmodelled zone, which is only a missing rate.
   *
   * This is the field a build gate should fail on. scripts/margin-check.ts
   * currently console.warns every entry of `warnings` without touching its exit
   * code; reading this array and calling process.exit(1) when it is non-empty
   * is what turns the signal into a gate.
   */
  underwaterInternationalDestinations: string[];
}

export type LandedCostResolution =
  | { ok: true; landed: ResolvedLandedCost }
  | { ok: false; reasons: string[] };

/**
 * DECIDED: this module states NO basket size at all.
 *
 * The flat $20 international charge is levied once per ORDER while freight is
 * rated on the whole shipment's weight, so coverage is a curve, not a boolean.
 * Every fixed basket size this file could pick is wrong in the same way: it was
 * 1, which called any multi-unit order covered; then 2, which still reported
 * nothing about the 4-unit order of the same variant that runs $19 underwater.
 *
 * So the check is now asked the question that has no assumption in it — how far
 * up the basket ladder does the charge reach — by passing `unitsPerOrder: null`.
 * The answer (`breakEvenUnitsPerOrder` plus `exposure`) is kept whole in
 * `internationalCoverage`, and the check warns whenever ANY basket the cart
 * permits runs past the ceiling. There is no longer a basket size for a loss to
 * hide behind, and nothing left for this module to assume.
 */

function integerCents(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Resolve one APLIIQ variant's landed cost.
 *
 * ASSUMPTION (decided): freight is allocated on the WORST case — the
 * single-unit tier rate for this variant's own weight, plus the per-unit
 * fulfillment fee. A real multi-item order amortises freight across the
 * shipment, so a gate built on the single-unit rate can understate margin but
 * can never bless an SKU that is actually underwater.
 *
 * ASSUMPTION (decided): the gate always prices DOMESTIC freight. US orders ship
 * free, so that freight comes straight out of margin. International orders pay
 * a flat charge that is revenue the retail price does not contain, so folding
 * international freight into this ratio would double-count; it is checked
 * separately as flat-rate coverage and surfaced in `internationalCoverage` and
 * `warnings`. That check is per-ORDER because the flat charge is per order — it
 * is NOT the per-unit figure the margin gate uses above, and the two must not be
 * conflated. It is also non-blocking: it never contributes a `reason`, because
 * a flat-rate shortfall is a pricing decision for the operator, not a malformed
 * variant. `underwaterInternationalDestinations` is how a gate acts on it.
 */
export function resolveApliiqLandedCost(variant: LandedCostVariant): LandedCostResolution {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const explicitItemCost = integerCents(variant.apliiqItemCost);
  const verifiedCost = integerCents(variant.costEstimate);
  const itemCostCents = explicitItemCost ?? verifiedCost;
  if (itemCostCents === undefined) {
    reasons.push("missing APLIIQ item cost");
  } else if (explicitItemCost !== undefined && verifiedCost !== undefined && explicitItemCost !== verifiedCost) {
    // Two costs that disagree is an operator error, not a number to pick from.
    reasons.push(`APLIIQ item cost ${explicitItemCost} does not match the verified cost estimate ${verifiedCost}`);
  }

  const weightOz = typeof variant.weightOz === "number" && Number.isFinite(variant.weightOz) && variant.weightOz > 0
    ? variant.weightOz
    : undefined;
  let freightCents: number | undefined;
  if (weightOz === undefined) {
    reasons.push("missing APLIIQ shipped weight (weightOz)");
  } else {
    try {
      const laddered = getApliiqDomesticShippingCents(weightOz);
      const declared = integerCents(variant.apliiqShippingCost);
      if (declared !== undefined && declared < laddered) {
        // An operator may only ever raise freight above the published tier.
        reasons.push(`APLIIQ shipping cost ${declared} is below the ${laddered} tier rate for ${weightOz} oz`);
      }
      freightCents = Math.max(laddered, declared ?? 0);
    } catch (error) {
      if (!(error instanceof ApliiqShippingRateError)) throw error;
      reasons.push(error.message);
    }
  }

  const fulfillmentFeeCents = integerCents(variant.apliiqFulfillmentFeeCents)
    ?? getApliiqFulfillmentFeeCentsPerUnit();
  const destinationTaxCents = integerCents(variant.apliiqDestinationTaxCents)
    ?? modelDestinationTaxCents((itemCostCents ?? 0) + fulfillmentFeeCents);

  const internationalCoverage: InternationalFlatRateCoverage[] = [];
  const underwaterInternationalDestinations: string[] = [];
  for (const country of variant.apliiqRegionAvailability ?? []) {
    if (country === DOMESTIC_COUNTRY || weightOz === undefined) continue;
    const coverage = checkInternationalFlatRateCoverage(country, {
      unitWeightOz: weightOz,
      // See the note above INTERNATIONAL coverage: no assumed basket size.
      unitsPerOrder: null,
    });
    // The whole result, not one string off it.
    internationalCoverage.push(coverage);
    warnings.push(...coverage.warnings);
    if (isInternationalFlatRateUnderwater(coverage)) {
      underwaterInternationalDestinations.push(coverage.countryCode);
    }
  }

  if (reasons.length > 0 || itemCostCents === undefined || freightCents === undefined) {
    return { ok: false, reasons };
  }

  return {
    ok: true,
    landed: {
      itemCostCents,
      freightCents,
      fulfillmentFeeCents,
      destinationTaxCents,
      warnings,
      internationalCoverage,
      underwaterInternationalDestinations,
      margin: calculateLandedContributionMargin({
        retailPrice: variant.retailPrice,
        providerItemCost: itemCostCents,
        freightCents,
        fulfillmentFeeCents,
        destinationTaxCents,
      }),
    },
  };
}
