import { describe, expect, it } from "vitest";
import { calculateContributionMargin, estimatePrintfulVariantCost } from "@/lib/commerce/margin";
import type { PrintTechnique } from "@/lib/types/product";

describe("profit model", () => {
  it("deduplicates repeated Printful placements and adds only additional placements", () => {
    const cost = estimatePrintfulVariantCost({
      currency: "USD",
      variant: { id: 4865, techniques: [{ technique_key: "dtg", discounted_price: "19.75" }] },
      product: { placements: [
        { id: "front", technique_key: "dtg", discounted_price: "6.75" },
        { id: "label_inside", technique_key: "dtg", discounted_price: "1.50" },
      ] },
    }, [
      { placement: "front", technique: "dtg" },
      { placement: "label_inside", technique: "dtg" },
      { placement: "label_inside", technique: "dtg" },
    ]);
    expect(cost).toBe(2125);
  });

  it("calculates contribution after fees, fulfillment, shipping, and allowance", () => {
    expect(calculateContributionMargin({
      retailPrice: 4000,
      printfulCost: 1800,
      squareFeeBasisPoints: 290,
      squareFixedFee: 30,
      shippingSubsidy: 500,
      refundReplacementAllowance: 200,
    })).toEqual({
      netRevenue: 4000,
      squareFee: 146,
      contributionMargin: 1354,
      contributionMarginRatio: 0.3385,
    });
  });

  it.each<[PrintTechnique, string]>([
    ["sticker", "digital"],
    ["knitting", "knitwear"],
  ])("maps Printful sync technique %s to price technique %s", (syncTechnique, priceTechnique) => {
    expect(estimatePrintfulVariantCost({
      currency: "USD",
      variant: { id: 1, techniques: [{ technique_key: priceTechnique, price: "8.25" }] },
      product: { placements: [] },
    }, [{ placement: "default", technique: syncTechnique }])).toBe(825);
  });
});
