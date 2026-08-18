import { describe, expect, it } from "vitest";
import { parseApliiqMapDocument } from "@/lib/data/apliiq-map";

function validEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    apliiqSku: "APQ-1998244S7A1",
    apliiqProductId: "product-1",
    apliiqVariantId: "variant-1",
    apliiqDecorationSnapshot: { front: { artworkUrl: "https://assets.example/front.png" } },
    apliiqPrivateLabelSnapshot: { neckLabel: { artworkUrl: "https://assets.example/label.png" } },
    apliiqAssetUrls: ["https://assets.example/front.png", "https://assets.example/label.png"],
    apliiqRegionAvailability: ["US"],
    apliiqSizeGuideReference: "sg-tee",
    apliiqMappingApproval: "approved",
    apliiqSampleApproval: "approved",
    squareMappingStatus: "active",
    costEstimate: 2500,
    marginEstimate: 2300,
    costVerifiedAt: "2026-08-16T00:00:00.000Z",
    marginVerifiedAt: "2026-08-16T00:00:00.000Z",
    weightOz: 7.9,
    ...overrides,
  };
}

function document(entry: Record<string, unknown>): unknown {
  return { map: { "apliiq-tee-m": entry } };
}

describe("APLIIQ map runtime parser", () => {
  it("accepts the empty live-off registry", () => {
    expect(parseApliiqMapDocument({ map: {} })).toEqual({ map: {} });
  });

  it("accepts a fully approved mapping with HTTPS assets and integer cents", () => {
    expect(parseApliiqMapDocument(document(validEntry())).map["apliiq-tee-m"]).toMatchObject({
      apliiqSku: "APQ-1998244S7A1", costEstimate: 2500, apliiqMappingApproval: "approved",
    });
  });

  it.each([
    ["negative cost", { costEstimate: -1 }, "finite nonnegative integer"],
    ["fractional margin", { marginEstimate: 10.5 }, "finite nonnegative integer"],
    ["pending mapping", { apliiqMappingApproval: "pending" }, "explicitly approved"],
    ["pending sample", { apliiqSampleApproval: "pending" }, "explicitly approved"],
    ["inactive Square map", { squareMappingStatus: "pending" }, "explicitly active"],
    ["empty decoration", { apliiqDecorationSnapshot: {} }, "nonempty object"],
    ["empty private label", { apliiqPrivateLabelSnapshot: {} }, "nonempty object"],
    ["HTTP asset", { apliiqAssetUrls: ["http://assets.example/front.png"] }, "HTTPS URL"],
    ["non-country region", { apliiqRegionAvailability: ["north_america"] }, "uppercase ISO alpha-2"],
  ])("rejects %s", (_label, override, expected) => {
    expect(() => parseApliiqMapDocument(document(validEntry(override)))).toThrow(expected);
  });

  it("rejects HTTP URLs nested inside production snapshots", () => {
    const entry = validEntry({
      apliiqDecorationSnapshot: { front: { artworkUrl: "http://assets.example/front.png" } },
    });
    expect(() => parseApliiqMapDocument(document(entry))).toThrow("HTTPS URL");
  });

  it("rejects unknown fields so mapping typos cannot silently activate", () => {
    expect(() => parseApliiqMapDocument(document(validEntry({ apliiqSkuTypo: "APQ-TEE-M" }))))
      .toThrow("is not a recognized field");
  });

  it("rejects a label-like value that is not an APLIIQ production SKU", () => {
    expect(() => parseApliiqMapDocument(document(validEntry({ apliiqSku: "APQ-TEE-M" }))))
      .toThrow("must be an APLIIQ APQ production SKU");
  });

  it("requires a shipped weight, because freight is billed by weight tier", () => {
    expect(() => parseApliiqMapDocument(document(validEntry({ weightOz: undefined }))))
      .toThrow("must be a finite positive number of ounces");
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["three decimals", 7.999],
  ])("rejects a %s weight", (_label, weightOz) => {
    expect(() => parseApliiqMapDocument(document(validEntry({ weightOz }))))
      .toThrow(/ounces|two decimal places/);
  });

  it("keeps the fractional tier ceilings of the rate ladder representable", () => {
    for (const weightOz of [7.9, 11.9, 143.99, 159.84]) {
      expect(parseApliiqMapDocument(document(validEntry({ weightOz }))).map["apliiq-tee-m"].weightOz)
        .toBe(weightOz);
    }
  });

  // Regression: the two-decimal check used to be `Math.round(v * 100) !== v * 100`,
  // and `v * 100` is not exact in binary floating point (4.35 * 100 is
  // 434.99999999999994). That rejected 4,587 of the 48,000 legal two-decimal
  // weights up to 480 oz — every one of these, all ordinary garment weights.
  it.each([4.35, 4.4, 8.15, 1.1, 0.07, 16.35])(
    "accepts %s oz, which the naive two-decimal float check wrongly rejected",
    (weightOz) => {
      expect(parseApliiqMapDocument(document(validEntry({ weightOz }))).map["apliiq-tee-m"].weightOz)
        .toBe(weightOz);
    }
  );

  it("still rejects a third decimal place after the float fix", () => {
    for (const weightOz of [1.005, 7.895, 12.345]) {
      expect(() => parseApliiqMapDocument(document(validEntry({ weightOz }))))
        .toThrow("two decimal places");
    }
  });

  it("accepts the optional landed-cost overrides as integer cents", () => {
    const entry = parseApliiqMapDocument(document(validEntry({
      apliiqItemCost: 2500,
      apliiqShippingCost: 596,
      apliiqFulfillmentFeeCents: 100,
      apliiqDestinationTaxCents: 0,
    }))).map["apliiq-tee-m"];
    expect(entry).toMatchObject({
      apliiqItemCost: 2500, apliiqShippingCost: 596, apliiqFulfillmentFeeCents: 100, apliiqDestinationTaxCents: 0,
    });
  });

  it("leaves the landed-cost overrides undefined so the rate sheet supplies defaults", () => {
    const entry = parseApliiqMapDocument(document(validEntry())).map["apliiq-tee-m"];
    expect(entry.apliiqItemCost).toBeUndefined();
    expect(entry.apliiqShippingCost).toBeUndefined();
    expect(entry.apliiqFulfillmentFeeCents).toBeUndefined();
    expect(entry.apliiqDestinationTaxCents).toBeUndefined();
  });

  it.each([
    ["apliiqItemCost", { apliiqItemCost: 25.5 }],
    ["apliiqShippingCost", { apliiqShippingCost: -1 }],
    ["apliiqFulfillmentFeeCents", { apliiqFulfillmentFeeCents: "100" }],
    ["apliiqDestinationTaxCents", { apliiqDestinationTaxCents: 1.5 }],
  ])("rejects a non-integer-cents %s", (_label, override) => {
    expect(() => parseApliiqMapDocument(document(validEntry(override))))
      .toThrow("finite nonnegative integer");
  });
});
