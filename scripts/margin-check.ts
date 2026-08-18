// Fails the build if any ACTIVE variant's margin is missing or below threshold (§15).
// Retail and cost are minor units (cents). Run: npm run margin-check
//
// APLIIQ variants are gated on LANDED cost — product cost plus the conservative
// single-unit freight tier, the $1.00 per-product fulfillment fee, modelled
// destination tax, and the Square processing fee. Legacy Printful variants stay
// on the historical product-cost gate (LEGACY_PRINTFUL_MARGIN_TERMS) until a
// verified Printful rate table exists.
import { loadProducts } from "@/lib/data/products";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";
import { calculateLandedContributionMargin, LEGACY_PRINTFUL_MARGIN_TERMS } from "@/lib/commerce/margin";

const MIN_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35"); // 35% default floor
const errors: string[] = [];
const warnings: string[] = [];
let missingCost = 0;

for (const p of loadProducts()) {
  if (p.status !== "active") continue;
  for (const v of p.variants) {
    if (v.status !== "active") continue;
    const id = `${p.slug}/${v.sku}`;
    if (!(v.retailPrice > 0)) { errors.push(`[${id}] missing retail price`); continue; }

    if (v.fulfillmentProvider === "apliiq") {
      const landed = resolveApliiqLandedCost(v);
      if (!landed.ok) {
        missingCost++;
        for (const reason of landed.reasons) errors.push(`[${id}] ${reason}`);
        continue;
      }
      const { margin, itemCostCents, freightCents, fulfillmentFeeCents, destinationTaxCents } = landed.landed;
      // Proven loss and missing data are NOT the same signal and must not share
      // an exit code. underwaterInternationalDestinations is quantified: a real
      // rate says the flat charge does not cover this destination inside the
      // cart's own limits. That fails. An unmodelled zone only means "no rate to
      // compare against" and stays a warning.
      const underwater = landed.landed.underwaterInternationalDestinations ?? [];
      if (underwater.length) {
        errors.push(`[${id}] flat international charge is underwater to ${underwater.join(", ")} within the cart's unit limit`);
      }
      for (const warning of landed.landed.warnings) {
        const proven = underwater.some((code: string) => warning.includes(code)) && !warning.includes("not modelled");
        (proven ? errors : warnings).push(`[${id}] ${warning}`);
      }
      // Honour the same per-variant exception purchasable.ts does, or this
      // script and the runtime gate disagree and the build fails on a variant
      // the storefront would happily sell.
      const override = v.marginFloorOverride;
      const floor = override ? Math.max(0, override.minRatio) : MIN_MARGIN_RATIO;
      if (margin.contributionMargin <= 0) {
        errors.push(`[${id}] landed cost exceeds retail price (retail ${v.retailPrice}, landed ${itemCostCents + freightCents + fulfillmentFeeCents + destinationTaxCents})`);
      } else if (margin.contributionMarginRatio < floor) {
        errors.push(`[${id}] landed margin ${(margin.contributionMarginRatio * 100).toFixed(1)}% below ${(floor * 100).toFixed(0)}% ${override ? "override " : ""}floor (retail ${v.retailPrice}, item ${itemCostCents}, freight ${freightCents}, fee ${fulfillmentFeeCents}, tax ${destinationTaxCents}, square ${margin.squareFee})`);
      } else if (override) {
        warnings.push(`[${id}] shipping under a ${(floor * 100).toFixed(0)}% override floor at ${(margin.contributionMarginRatio * 100).toFixed(1)}% — ${override.reason}`);
      }
      continue;
    }

    if (v.costEstimate == null) { missingCost++; errors.push(`[${id}] missing verified fulfillment cost`); continue; }
    const legacy = calculateLandedContributionMargin({
      retailPrice: v.retailPrice,
      providerItemCost: v.costEstimate,
      ...LEGACY_PRINTFUL_MARGIN_TERMS,
    });
    if (legacy.contributionMarginRatio < MIN_MARGIN_RATIO) {
      errors.push(`[${id}] margin ${(legacy.contributionMarginRatio * 100).toFixed(1)}% below ${(MIN_MARGIN_RATIO * 100).toFixed(0)}% floor (retail ${v.retailPrice}, cost ${v.costEstimate})`);
    }
  }
}
// Modelling gaps are reported but do not fail the build: an unmodelled
// international zone means "no verified rate to compare against", not a proven
// loss. It must still be visible on every run. A QUANTIFIED loss against a real
// rate is an error above, not a warning here — before 2026-08-17 both landed in
// this array and the run exited 0 either way, which was only harmless because
// the catalog had zero active APLIIQ variants.
if (warnings.length) console.warn(`! margin-check: ${warnings.length} modelling warning(s):\n  - ${warnings.join("\n  - ")}`);
if (errors.length) {
  console.error(`✗ margin-check: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
if (missingCost > 0) console.error(`✗ margin-check: ${missingCost} active variant(s) have no verified cost estimate.`);
console.log(`✓ margin-check: no active variant is below the ${(MIN_MARGIN_RATIO * 100).toFixed(0)}% margin floor`);
