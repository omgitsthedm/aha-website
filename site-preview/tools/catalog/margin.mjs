// Per-size contribution after supplier cost, shipping, fulfillment, label and
// card fees. Publishing is blocked when any size falls below the floor.
import { CatalogError } from "./lib.mjs";

const fee = ({ percent, fixedCents }, cents) => Math.round((cents * percent) / 100) + fixedCents;

export function marginReport(spec, costs) {
  const blank = costs.blanks[spec.blank];
  if (!blank) throw new CatalogError(`${spec.slug}: no cost record for blank ${spec.blank}; add it to catalog/costs.json from a current Apliiq quote.`, { code: "cost_unknown", exit: 5 });
  const baseCents = spec.costOverride?.baseCents ?? blank.baseCents;
  const sizes = spec.sizes.map((size) => {
    const supplier = baseCents + (spec.costOverride?.surchargeCents?.[size] ?? blank.surchargeCents?.[size] ?? 0);
    const shipping = costs.largeSizes.includes(size) ? blank.largeShippingCents : blank.shippingCents;
    const cost = supplier + shipping + costs.perItemCents + costs.labelCents + fee(costs.cardFee, spec.priceCents);
    const afterpayCost = cost - fee(costs.cardFee, spec.priceCents) + fee(costs.afterpayFee, spec.priceCents);
    return { size, costCents: cost, contributionCents: spec.priceCents - cost, afterpayContributionCents: spec.priceCents - afterpayCost };
  });
  const worst = sizes.reduce((low, row) => (row.contributionCents < low.contributionCents ? row : low), sizes[0]);
  return {
    slug: spec.slug,
    priceCents: spec.priceCents,
    estimate: !spec.costOverride,
    floorCents: costs.floorCents,
    pass: sizes.every((row) => row.contributionCents >= costs.floorCents),
    worstSize: worst.size,
    worstContributionCents: worst.contributionCents,
    sizes,
  };
}
