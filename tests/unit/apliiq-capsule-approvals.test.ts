import { describe, expect, it } from "vitest";
import type { ApliiqMapEntry } from "@/lib/data/apliiq-map";
import {
  capsuleApprovalFingerprint,
  requireExplicitCapsuleApprovals,
  resolveCapsuleVariantApprovals,
  type CapsuleProductProductionIdentity,
  type CapsuleVariantProductionIdentity,
} from "@/scripts/lib/apliiq-capsule-approvals";

const productIdentity: CapsuleProductProductionIdentity = {
  slug: "test-tee",
  productCode: "mens_Test-Tee",
  colorId: 50,
  frontLocationId: 4548,
  designId: 22,
  artworkId: 11,
  artworkUrl: "https://example.com/art.png",
  service: "transfer_print",
  printNote: "Centered",
  privateLabelStatus: "not-attached",
  sizeGuideId: "sg-test",
  variants: [
    { size: "m", sku: "APQ-22S7A1" },
    { size: "s", sku: "APQ-22S6A1" },
  ],
};
const fingerprint = capsuleApprovalFingerprint(productIdentity);
const explicit = {
  productionFingerprint: fingerprint,
  mapping: { status: "approved", approvedAt: "2026-08-19" },
  sample: { status: "approved", approvedAt: "2026-08-18" },
};
const identity: CapsuleVariantProductionIdentity = {
  designId: 22,
  sku: "APQ-22S7A1",
  artworkId: 11,
  artworkUrl: "https://example.com/art.png",
  service: "transfer_print",
  printNote: "Centered",
  privateLabelStatus: "not-attached",
  sizeGuideId: "sg-test",
};
const prior = {
  apliiqProductId: "22",
  apliiqSku: "APQ-22S7A1",
  apliiqDecorationSnapshot: {
    front: {
      method: "DTF",
      service: "transfer_print",
      apliiqArtworkId: 11,
      artworkUrl: "https://example.com/art.png",
      note: "Centered",
    },
  },
  apliiqPrivateLabelSnapshot: { status: "not-attached" },
  apliiqSizeGuideReference: "sg-test",
  apliiqMappingApproval: "approved",
  apliiqSampleApproval: "approved",
} as ApliiqMapEntry;

describe("APLIIQ capsule approval provenance", () => {
  it("preserves approvals only for an identity-preserving mapped variant", () => {
    expect(resolveCapsuleVariantApprovals("test-tee", "test-tee-m", prior, undefined, identity, fingerprint)).toEqual({
      apliiqMappingApproval: "approved",
      apliiqSampleApproval: "approved",
    });
  });

  it.each([
    ["size guide", { sizeGuideId: "sg-different" }],
  ])("does not carry prior approval after a %s mismatch", (_label, changed) => {
    expect(() => resolveCapsuleVariantApprovals(
      "test-tee", "test-tee-m", prior, undefined, { ...identity, ...changed }, fingerprint,
    )).toThrow(/prior approval identity.*identity-bound mapping and sample approvals/);
  });

  it("does not carry a legacy claim that an unattached private label was active", () => {
    const claimedLabel = {
      ...prior,
      apliiqPrivateLabelSnapshot: { neckLabel: { subscription: "SB-2-155690" } },
    } as ApliiqMapEntry;
    expect(() => resolveCapsuleVariantApprovals(
      "test-tee", "test-tee-m", claimedLabel, undefined, identity, fingerprint,
    )).toThrow(/prior approval identity.*identity-bound mapping and sample approvals/);
  });

  it("requires fresh identity-bound approvals when any older identity mismatches", () => {
    const changedArtwork = { ...identity, artworkId: 12 };
    expect(() => resolveCapsuleVariantApprovals("test-tee", "test-tee-m", prior, undefined, changedArtwork, fingerprint))
      .toThrow(new RegExp(fingerprint));
    expect(resolveCapsuleVariantApprovals("test-tee", "test-tee-m", prior, explicit, changedArtwork, fingerprint)).toEqual({
      apliiqMappingApproval: "approved",
      apliiqSampleApproval: "approved",
    });
  });

  it("accepts the exact deterministic full-product fingerprint regardless of variant order", () => {
    const reordered = capsuleApprovalFingerprint({ ...productIdentity, variants: [...productIdentity.variants].reverse() });
    expect(reordered).toBe(fingerprint);
    expect(requireExplicitCapsuleApprovals("test-tee", explicit, fingerprint)).toEqual({
      mappingApprovedAt: "2026-08-19",
      sampleApprovedAt: "2026-08-18",
    });
    expect(resolveCapsuleVariantApprovals("test-tee", "test-tee-m", undefined, explicit, identity, fingerprint)).toEqual({
      apliiqMappingApproval: "approved",
      apliiqSampleApproval: "approved",
    });
  });

  it("rejects a stale approval fingerprint and prints the exact replacement", () => {
    const stale = { ...explicit, productionFingerprint: "0".repeat(64) };
    expect(() => requireExplicitCapsuleApprovals("test-tee", stale, fingerprint))
      .toThrow(new RegExp(`stale or missing.*${fingerprint}`));
  });

  it.each([
    [undefined, /approvals.mapping.status/],
    [{ productionFingerprint: fingerprint, mapping: { status: "approved", approvedAt: "2026-08-19" } }, /approvals.sample.status/],
    [{ ...explicit, mapping: { status: "approved", approvedAt: "yesterday" } }, /YYYY-MM-DD/],
    [{ ...explicit, mapping: { status: "approved", approvedAt: "2026-02-30" } }, /real calendar date/],
  ])("refuses incomplete or invented approval evidence", (approval, expected) => {
    expect(() => resolveCapsuleVariantApprovals("test-tee", "test-tee-m", undefined, approval, identity, fingerprint)).toThrow(expected);
    expect(() => resolveCapsuleVariantApprovals("test-tee", "test-tee-m", undefined, approval, identity, fingerprint)).toThrow(fingerprint);
  });
});
