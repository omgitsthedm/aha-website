import type { AhaVariant } from "@/lib/types/product";

interface TechniquePrice {
  technique_key: string;
  price?: string;
  discounted_price?: string;
}

interface PlacementPrice {
  id: string;
  technique_key?: string;
  price?: string;
  discounted_price?: string;
}

export interface PrintfulVariantPriceData {
  currency: string;
  variant: { id: number; techniques: TechniquePrice[] };
  product: { placements: PlacementPrice[] };
}

const cents = (value: string | undefined): number => Math.round(Number(value || 0) * 100);
const PRINTFUL_PRICE_TECHNIQUE: Record<string, string> = {
  sticker: "digital",
  knitting: "knitwear",
  // Sync-product payloads label UV-printed accessories (crossbody bags)
  // with the legacy "phone-case" technique; the price API calls it "uv".
  "phone-case": "uv",
};
const priceTechnique = (technique: string | undefined): string | undefined =>
  technique ? (PRINTFUL_PRICE_TECHNIQUE[technique] ?? technique) : undefined;

/**
 * Printful's variant technique price includes the first configured print placement. Additional
 * unique placements are additive. Duplicate placement rows from sync-product payloads are ignored.
 */
export function estimatePrintfulVariantCost(
  priceData: PrintfulVariantPriceData,
  placements: NonNullable<AhaVariant["printfulPlacements"]>
): number | null {
  const unique = Array.from(new Map(
    placements.map((placement) => [`${placement.placement}:${placement.technique}`, placement])
  ).values());
  const primary = unique[0];
  if (!primary) return null;
  const primaryTechnique = priceTechnique(primary.technique);
  const technique = priceData.variant.techniques.find((item) => item.technique_key === primaryTechnique);
  if (!technique) return null;

  let total = cents(technique.discounted_price || technique.price);
  for (const placement of unique.slice(1)) {
    const price = priceData.product.placements.find((item) =>
      item.id === placement.placement &&
      (!item.technique_key || item.technique_key === priceTechnique(placement.technique))
    );
    total += cents(price?.discounted_price || price?.price);
  }
  return total > 0 ? total : null;
}

export const DEFAULT_SQUARE_FEE_BASIS_POINTS = 290;
export const DEFAULT_SQUARE_FIXED_FEE_CENTS = 30;

/**
 * APLIIQ's destination sales tax, as it actually bills (verified at source
 * 2026-08-17): it is DESTINATION-based, not nexus-based — "ONLY applicable if an
 * order's end shipping address is in the state of CA, but then 9.5% sales tax
 * would apply".
 * https://help.apliiq.com/portal/en/kb/articles/understanding-apliiq-dropship-product-pricing
 *
 * Two earlier readings of this file are SUPERSEDED and must not be restored:
 *  - "no California resale certificate is on file, so model 1025 bp on every
 *    order" — wrong rate, and wrong to apply to the ~92% of orders that never
 *    touch California.
 *  - "After Hours Agenda has no California presence, so the term is ZERO" —
 *    AHA's own presence is irrelevant. Any order shipping to a CA address is
 *    invoiced 9.5% by APLIIQ wherever AHA sits.
 *
 * Scope, stated precisely so a future reader does not overreach: this models tax
 * APLIIQ bills TO AHA. It says nothing about sales tax AHA may owe on retail
 * sales to customers — that is an economic-nexus question decided per state in
 * Square's tax settings, not here.
 *
 * The gate runs per VARIANT, before a destination exists, so it cannot apply a
 * per-order rate. It uses the blended expected rate:
 *     blended = CA_RATE x CA_SHARE = 950 bp x 7.97% = 76 bp
 * CA share measured from AHA's own Square history 2026-08-17: 11 of 138 shipments
 * with a recorded state were CA (AZ 51, NY 39, CA 11). Re-measure as the order
 * base grows; if CA share doubles, so does this term.
 *
 * For EXACT per-order costing use APLIIQ_CA_DESTINATION_TAX_BASIS_POINTS against
 * the real destination, or override a variant via `apliiqDestinationTaxCents`.
 *
 * MOVING EITHER INPUT IS NOT A FREE SWITCH. No migration is needed, but a DATA
 * REWRITE IS: lib/data/purchasable.ts reconciles each variant's stored
 * `marginEstimate` against the recomputed landed `contributionMargin` by EXACT
 * equality, and this tax term is one of its components. Measured on a $65.00 tee
 * at $21.25 item cost / 7.9 oz, the gate demands 3443 at the current 76 bp
 * blended rate — against 3460 at 0 bp and 3232 at the old flat 1025 bp — so
 * moving either constant quarantines every APLIIQ variant whose `marginEstimate`
 * still holds the old figure, failing validate-apliiq-map and margin-check
 * before deploy. Re-derive every `marginEstimate` in data/apliiq-map.json in the
 * same change. The same coupling applies to any freight repricing or a change to
 * the per-unit fulfillment fee. See tests/unit/margin.test.ts
 * ("destination tax term is coupled to every stored marginEstimate").
 */
/**
 * APLIIQ's published CA rate, kept for reference and for exact per-order
 * costing. NOT applied to the build-time gate — see the decision below.
 */
export const APLIIQ_CA_DESTINATION_TAX_BASIS_POINTS = 950;

/** Measured CA share of AHA shipments, in basis points. Square history 2026-08-17. */
export const APLIIQ_CA_ORDER_SHARE_BASIS_POINTS = 797;

/**
 * ZERO by merchant decision (David, 2026-08-17), reaffirmed after review.
 *
 * I flagged that APLIIQ's tax keys on the customer's shipping address rather
 * than AHA's nexus, so CA-destined orders are invoiced 9.5% regardless of where
 * AHA sits. David's call is to carry no tax term on the cost side anyway. That
 * is his to make and the exposure is small: at the measured 7.97% CA share, the
 * blended understatement is 950 x 797 / 10,000 = 76 bp, about $0.17 on a $21.25
 * tee averaged across all orders — roughly $2.11 on an actual CA order.
 *
 * If CA volume grows materially, revisit: the honest blended figure is already
 * computed above and is one multiplication away.
 */
export const APLIIQ_DESTINATION_TAX_BASIS_POINTS = 0;

/**
 * Freight is not part of the taxable base when it is separately stated on the
 * invoice, which is exactly how APLIIQ bills it, so the modelled tax applies to
 * product cost plus the per-unit fulfillment fee only.
 */
export function modelDestinationTaxCents(
  taxableBaseCents: number,
  basisPoints: number = APLIIQ_DESTINATION_TAX_BASIS_POINTS
): number {
  if (basisPoints <= 0 || taxableBaseCents <= 0) return 0;
  return Math.round(taxableBaseCents * (basisPoints / 10_000));
}

/**
 * Provider-neutral landed-cost inputs. Every cost term is explicit and in
 * minor units so a gate can never quietly omit one: the bug this replaced
 * computed `retailPrice - costEstimate` and reported 37.5% on a tee whose real
 * landed contribution was 13.2%.
 */
export interface LandedCostInput {
  retailPrice: number;
  /** Provider product cost for ONE unit (garment + decoration). */
  providerItemCost: number;
  discount?: number;
  squareFeeBasisPoints?: number;
  squareFixedFee?: number;
  /** Conservative single-unit freight for this variant. Billed separately by APLIIQ. */
  freightCents?: number;
  /** Per-PRODUCT provider fulfillment fee. APLIIQ charges $1.00 per unit. */
  fulfillmentFeeCents?: number;
  /** Destination sales tax charged on the provider invoice. */
  destinationTaxCents?: number;
  refundReplacementAllowance?: number;
}

export interface LandedMarginResult {
  netRevenue: number;
  squareFee: number;
  /** Everything the order costs before payment fees: item + freight + fee + tax. */
  landedCost: number;
  contributionMargin: number;
  contributionMarginRatio: number;
}

/**
 * THE landed-margin calculation. Every margin gate in the repo routes through
 * this one function — lib/data/purchasable.ts, scripts/margin-check.ts and
 * scripts/enforce-margin-policy.ts — so a term can only be added or corrected
 * in one place.
 */
export function calculateLandedContributionMargin(input: LandedCostInput): LandedMarginResult {
  const netRevenue = Math.max(0, input.retailPrice - (input.discount ?? 0));
  const squareFee = Math.round(netRevenue * ((input.squareFeeBasisPoints ?? DEFAULT_SQUARE_FEE_BASIS_POINTS) / 10_000)) +
    (input.squareFixedFee ?? DEFAULT_SQUARE_FIXED_FEE_CENTS);
  const landedCost = input.providerItemCost +
    (input.freightCents ?? 0) +
    (input.fulfillmentFeeCents ?? 0) +
    (input.destinationTaxCents ?? 0);
  const contributionMargin = netRevenue - squareFee - landedCost -
    (input.refundReplacementAllowance ?? 0);
  return {
    netRevenue,
    squareFee,
    landedCost,
    contributionMargin,
    contributionMarginRatio: netRevenue > 0 ? contributionMargin / netRevenue : -1,
  };
}

/**
 * Term set that preserves the historical Printful gate exactly: product cost
 * only, no payment fee, no freight, no fee, no tax.
 *
 * This is a KNOWN GAP, not a claim that Printful freight is free. Printful
 * quotes shipping per order at fulfillment time and no verified Printful rate
 * ladder is committed to this repo, so inventing one here would be worse than
 * naming the gap. Applying the Square fee alone to the 1,005 active legacy
 * variants would quarantine 122 of them, which is a catalog decision rather
 * than a calculation fix. Commit a Printful rate table and replace these zeros.
 */
export const LEGACY_PRINTFUL_MARGIN_TERMS = Object.freeze({
  squareFeeBasisPoints: 0,
  squareFixedFee: 0,
  freightCents: 0,
  fulfillmentFeeCents: 0,
  destinationTaxCents: 0,
} as const);
