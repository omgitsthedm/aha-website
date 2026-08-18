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
      for (const warning of landed.landed.warnings) warnings.push(`[${id}] ${warning}`);
      if (margin.contributionMarginRatio < MIN_MARGIN_RATIO) {
        errors.push(`[${id}] landed margin ${(margin.contributionMarginRatio * 100).toFixed(1)}% below ${(MIN_MARGIN_RATIO * 100).toFixed(0)}% floor (retail ${v.retailPrice}, item ${itemCostCents}, freight ${freightCents}, fee ${fulfillmentFeeCents}, tax ${destinationTaxCents}, square ${margin.squareFee})`);
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
// loss. It must still be visible on every run.
if (warnings.length) console.warn(`! margin-check: ${warnings.length} modelling warning(s):\n  - ${warnings.join("\n  - ")}`);
if (errors.length) {
  console.error(`✗ margin-check: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
if (missingCost > 0) console.error(`✗ margin-check: ${missingCost} active variant(s) have no verified cost estimate.`);
console.log(`✓ margin-check: no active variant is below the ${(MIN_MARGIN_RATIO * 100).toFixed(0)}% margin floor`);
