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
});
