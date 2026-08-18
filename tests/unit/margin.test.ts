import { describe, expect, it } from "vitest";
import {
  APLIIQ_CA_DESTINATION_TAX_BASIS_POINTS,
  APLIIQ_CA_ORDER_SHARE_BASIS_POINTS,
  APLIIQ_DESTINATION_TAX_BASIS_POINTS,
  LEGACY_PRINTFUL_MARGIN_TERMS,
  calculateLandedContributionMargin,
  estimatePrintfulVariantCost,
  modelDestinationTaxCents,
} from "@/lib/commerce/margin";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
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

  it("calculates contribution after fees, freight, per-product fee, tax, and allowance", () => {
    expect(calculateLandedContributionMargin({
      retailPrice: 4000,
      providerItemCost: 1800,
      squareFeeBasisPoints: 290,
      squareFixedFee: 30,
      freightCents: 500,
      fulfillmentFeeCents: 100,
      destinationTaxCents: 200,
      refundReplacementAllowance: 200,
    })).toEqual({
      netRevenue: 4000,
      squareFee: 146,
      landedCost: 2600,
      contributionMargin: 1054,
      contributionMarginRatio: 0.2635,
    });
  });

  // This is the exact SKU from the bug report: the old gate computed
  // retailPrice - costEstimate and reported 37.5% on a tee whose real landed
  // contribution is 13.2%.
  it("reports 13.2% on the 7.9 oz tee the product-cost gate blessed at 37.5%", () => {
    const productCostOnlyRatio = (3400 - 2125) / 3400;
    expect(Number((productCostOnlyRatio * 100).toFixed(1))).toBe(37.5);

    const landed = calculateLandedContributionMargin({
      retailPrice: 3400,
      providerItemCost: 2125,
      freightCents: 596,
      fulfillmentFeeCents: 100,
      destinationTaxCents: 0,
    });
    expect(landed).toEqual({
      netRevenue: 3400,
      squareFee: 129,
      landedCost: 2821,
      contributionMargin: 450,
      contributionMarginRatio: 450 / 3400,
    });
    expect(Number((landed.contributionMarginRatio * 100).toFixed(1))).toBe(13.2);
    expect(landed.contributionMarginRatio).toBeLessThan(0.35);
  });

  it("omitted cost terms default to zero rather than throwing, so a gate cannot half-configure silently", () => {
    expect(calculateLandedContributionMargin({ retailPrice: 3400, providerItemCost: 2125 })).toMatchObject({
      landedCost: 2125,
      squareFee: 129,
      contributionMargin: 1146,
    });
  });

  it("nets a discount out of revenue before the payment fee", () => {
    const result = calculateLandedContributionMargin({
      retailPrice: 4000, providerItemCost: 1000, discount: 1000,
    });
    expect(result.netRevenue).toBe(3000);
    expect(result.squareFee).toBe(Math.round(3000 * 0.029) + 30);
  });

  it("reports -1 rather than dividing by zero when a discount consumes the whole price", () => {
    expect(calculateLandedContributionMargin({
      retailPrice: 4000, providerItemCost: 1000, discount: 9999,
    }).contributionMarginRatio).toBe(-1);
  });

  it("models destination tax on product plus fulfillment fee and zeroes out on a 0 rate", () => {
    // Freight is separately stated on the APLIIQ invoice, so it is not part of
    // the taxable base.
    expect(modelDestinationTaxCents(2600)).toBe(Math.round(2600 * (APLIIQ_DESTINATION_TAX_BASIS_POINTS / 10_000)));
    // The whole tax term disappears the day a resale certificate is on file.
    expect(modelDestinationTaxCents(2600, 0)).toBe(0);
    expect(modelDestinationTaxCents(0)).toBe(0);
  });

  it("keeps the legacy Printful gate on product cost only", () => {
    // Documented gap: no verified Printful rate table is committed, so the
    // shared calculation is fed explicit zeros rather than invented freight.
    expect(LEGACY_PRINTFUL_MARGIN_TERMS).toEqual({
      squareFeeBasisPoints: 0,
      squareFixedFee: 0,
      freightCents: 0,
      fulfillmentFeeCents: 0,
      destinationTaxCents: 0,
    });
    expect(calculateLandedContributionMargin({
      retailPrice: 4800, providerItemCost: 2500, ...LEGACY_PRINTFUL_MARGIN_TERMS,
    })).toEqual({
      netRevenue: 4800,
      squareFee: 0,
      landedCost: 2500,
      contributionMargin: 2300,
      contributionMarginRatio: 2300 / 4800,
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

// The tax constant's doc-comment used to promise that changing it cost nothing
// but the edit itself. It does not: purchasable.ts reconciles each variant's
// stored marginEstimate against the recomputed landed contribution by EXACT
// equality, and the tax term is one of its components. This pins the coupling
// so the comment cannot quietly go back to being wrong.
//
// This block deliberately does NOT read the coupling off the constant's current
// value. An earlier version did, asserting the modelled tax was > 0, and it went
// from proving the coupling to failing outright the moment the rate was
// re-derived — twice in one day, first to 0 and then to the 76 bp blend. It
// exercises the tax TERM instead, which is live at any rate:
// `apliiqDestinationTaxCents` is the per-variant override an exactly-invoiced
// tax arrives on, and it feeds the same `destinationTaxCents` input that
// modelDestinationTaxCents feeds.
describe("destination tax term is coupled to every stored marginEstimate", () => {
  const variant = {
    retailPrice: 6500,
    costEstimate: 2125,
    weightOz: 7.9,
    apliiqRegionAvailability: ["US"],
  };

  // What APLIIQ actually invoices on a CA-bound line: 9.5% of 2125 item + 100
  // fulfillment fee. Deliberately NOT the blended modelled figure — the whole
  // point is that a stored estimate carrying one term is invalid under another.
  const INVOICED_TAX_CENTS = 211;

  it("moves the landed contribution the purchasable gate demands", () => {
    const modelled = resolveApliiqLandedCost(variant as never);
    const invoiced = resolveApliiqLandedCost(
      { ...variant, apliiqDestinationTaxCents: INVOICED_TAX_CENTS } as never,
    );
    if (!modelled.ok || !invoiced.ok) throw new Error("both fixtures must resolve");

    const modelledTax = modelDestinationTaxCents(2125 + modelled.landed.fulfillmentFeeCents);
    expect(modelled.landed.destinationTaxCents).toBe(modelledTax);
    expect(invoiced.landed.destinationTaxCents).toBe(INVOICED_TAX_CENTS);
    // Guards the guard: if the two terms ever coincide this test proves nothing.
    expect(INVOICED_TAX_CENTS).not.toBe(modelledTax);

    // A different tax term moves the contribution by exactly that difference, so
    // a marginEstimate stored under one term is invalid under the other.
    expect(modelled.landed.margin.contributionMargin - invoiced.landed.margin.contributionMargin)
      .toBe(INVOICED_TAX_CENTS - modelledTax);
  });

  it("carries NO destination tax on the gate, by merchant decision", () => {
    // David's call, 2026-08-17, reaffirmed after I flagged that APLIIQ's tax
    // keys on the CUSTOMER's shipping address rather than AHA's nexus — a
    // CA-destined order is invoiced 9.5% wherever AHA sits. He accepts that
    // exposure rather than carrying a tax term on the cost side.
    expect(APLIIQ_DESTINATION_TAX_BASIS_POINTS).toBe(0);
    expect(modelDestinationTaxCents(2225)).toBe(0);
  });

  it("keeps the real CA rate and the measured share available for per-order costing", () => {
    // Zeroing the gate must not delete the arithmetic. These two constants are
    // what a per-order cost calculation or a future revisit needs, and the
    // honest blended figure is one multiplication away.
    expect(APLIIQ_CA_DESTINATION_TAX_BASIS_POINTS).toBe(950);
    expect(modelDestinationTaxCents(2225, APLIIQ_CA_DESTINATION_TAX_BASIS_POINTS))
      .toBe(INVOICED_TAX_CENTS);

    const blended = Math.round(
      (APLIIQ_CA_DESTINATION_TAX_BASIS_POINTS * APLIIQ_CA_ORDER_SHARE_BASIS_POINTS) / 10_000,
    );
    // 76 bp — what the gate WOULD carry if the decision were reversed. Pinned so
    // the size of the accepted exposure stays visible rather than becoming folklore.
    expect(blended).toBe(76);
    expect(blended).toBeGreaterThan(APLIIQ_DESTINATION_TAX_BASIS_POINTS);
    expect(blended).toBeLessThan(APLIIQ_CA_DESTINATION_TAX_BASIS_POINTS);
  });

  it("rejects a marginEstimate derived with a tax term the model does not hold", () => {
    const product = { status: "active", sizeGuideId: "sg-1" } as never;
    const base = {
      ...variant,
      status: "active",
      fulfillmentProvider: "apliiq",
      squareCatalogObjectId: "sq-cat",
      squareVariationId: "sq-var",
      squareMappingStatus: "active",
      apliiqSku: "APQ-TEE-BLK-M",
      apliiqDecorationSnapshot: { placement: "front" },
      apliiqPrivateLabelSnapshot: { neck: "printed" },
      costVerifiedAt: "2026-08-17",
      marginVerifiedAt: "2026-08-17",
      size: "M",
    };
    const modelled = resolveApliiqLandedCost(variant as never);
    const invoiced = resolveApliiqLandedCost(
      { ...variant, apliiqDestinationTaxCents: INVOICED_TAX_CENTS } as never,
    );
    if (!modelled.ok || !invoiced.ok) throw new Error("both fixtures must resolve");

    const withCurrentTerm = checkVariantPurchasable(
      product,
      { ...base, marginEstimate: modelled.landed.margin.contributionMargin } as never,
    );
    expect(withCurrentTerm.reasons).not.toContain(
      `APLIIQ margin does not match landed cost (expected ${modelled.landed.margin.contributionMargin})`,
    );

    // A stored figure carrying a tax term this variant no longer declares,
    // checked against the model as it stands today: quarantined.
    const withOtherTerm = checkVariantPurchasable(
      product,
      { ...base, marginEstimate: invoiced.landed.margin.contributionMargin } as never,
    );
    expect(withOtherTerm.reasons).toContain(
      `APLIIQ margin does not match landed cost (expected ${modelled.landed.margin.contributionMargin})`,
    );
  });
});
