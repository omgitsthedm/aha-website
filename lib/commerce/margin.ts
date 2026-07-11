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

export interface ContributionMarginInput {
  retailPrice: number;
  printfulCost: number;
  discount?: number;
  squareFeeBasisPoints?: number;
  squareFixedFee?: number;
  shippingSubsidy?: number;
  refundReplacementAllowance?: number;
}

export interface ContributionMarginResult {
  netRevenue: number;
  squareFee: number;
  contributionMargin: number;
  contributionMarginRatio: number;
}

export function calculateContributionMargin(input: ContributionMarginInput): ContributionMarginResult {
  const netRevenue = Math.max(0, input.retailPrice - (input.discount ?? 0));
  const squareFee = Math.round(netRevenue * ((input.squareFeeBasisPoints ?? 290) / 10_000)) +
    (input.squareFixedFee ?? 30);
  const contributionMargin = netRevenue - squareFee - input.printfulCost -
    (input.shippingSubsidy ?? 0) - (input.refundReplacementAllowance ?? 0);
  return {
    netRevenue,
    squareFee,
    contributionMargin,
    contributionMarginRatio: netRevenue > 0 ? contributionMargin / netRevenue : -1,
  };
}
