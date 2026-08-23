import { createHash } from "node:crypto";
import type { ApliiqMapEntry } from "@/lib/data/apliiq-map";

export interface CapsuleApprovalRecord {
  status?: string;
  approvedAt?: string;
}

export interface CapsuleApprovalMetadata {
  productionFingerprint?: string;
  mapping?: CapsuleApprovalRecord;
  sample?: CapsuleApprovalRecord;
}

export interface CapsuleVariantProductionIdentity {
  designId: number;
  sku: string;
  artworkId: number;
  artworkUrl: string;
  service: string;
  printNote: string;
  privateLabel: string;
  sizeGuideId: string;
}

export interface CapsuleProductProductionIdentity {
  slug: string;
  productCode: string;
  colorId: number;
  frontLocationId: number;
  designId: number;
  artworkId: number;
  artworkUrl: string;
  service: string;
  printNote: string;
  privateLabel: string;
  sizeGuideId: string;
  variants: Array<{ size: string; sku: string }>;
}

function approvedDate(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path} must be an explicit YYYY-MM-DD approval date`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${path} must be a real calendar date in YYYY-MM-DD form`);
  }
  return value;
}

/**
 * Stable SHA-256 binding for the complete sellable production identity. Variant
 * order is deliberately canonicalized so provider response ordering cannot
 * invalidate an otherwise identical human approval.
 */
export function capsuleApprovalFingerprint(identity: CapsuleProductProductionIdentity): string {
  const canonical = {
    version: 1,
    slug: identity.slug,
    productCode: identity.productCode,
    colorId: identity.colorId,
    frontLocationId: identity.frontLocationId,
    designId: identity.designId,
    artworkId: identity.artworkId,
    artworkUrl: identity.artworkUrl,
    service: identity.service,
    printNote: identity.printNote,
    privateLabel: identity.privateLabel,
    sizeGuideId: identity.sizeGuideId,
    variants: identity.variants
      .map(({ size, sku }) => ({ size, sku }))
      .sort((left, right) => left.size.localeCompare(right.size) || left.sku.localeCompare(right.sku)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function approvalError(slug: string, expectedFingerprint: string, message: string): Error {
  return new Error(`${slug}: ${message}. Expected production fingerprint: ${expectedFingerprint}`);
}

/** Validate explicit, dated, identity-bound human evidence without manufacturing it. */
export function requireExplicitCapsuleApprovals(
  slug: string,
  approvals: CapsuleApprovalMetadata | undefined,
  expectedFingerprint: string,
): { mappingApprovedAt: string; sampleApprovedAt: string } {
  if (approvals?.mapping?.status !== "approved") {
    throw approvalError(slug, expectedFingerprint, 'new or redesigned APLIIQ variants require approvals.mapping.status = "approved" in data/apliiq-capsule.json');
  }
  if (approvals?.sample?.status !== "approved") {
    throw approvalError(slug, expectedFingerprint, 'new or redesigned APLIIQ variants require approvals.sample.status = "approved" in data/apliiq-capsule.json');
  }
  let mappingApprovedAt: string;
  let sampleApprovedAt: string;
  try {
    mappingApprovedAt = approvedDate(approvals.mapping.approvedAt, `${slug}: approvals.mapping.approvedAt`);
    sampleApprovedAt = approvedDate(approvals.sample.approvedAt, `${slug}: approvals.sample.approvedAt`);
  } catch (error) {
    throw approvalError(slug, expectedFingerprint, error instanceof Error ? error.message : String(error));
  }
  if (approvals.productionFingerprint !== expectedFingerprint) {
    const received = approvals.productionFingerprint === undefined
      ? "missing"
      : JSON.stringify(approvals.productionFingerprint);
    throw approvalError(slug, expectedFingerprint, `approvals.productionFingerprint is stale or missing (received ${received})`);
  }
  return { mappingApprovedAt, sampleApprovedAt };
}

export function mapEntryMatchesProductionIdentity(
  prior: ApliiqMapEntry,
  current: CapsuleVariantProductionIdentity,
): boolean {
  const front = prior.apliiqDecorationSnapshot?.front as {
    apliiqArtworkId?: number;
    artworkUrl?: string;
    service?: string;
    note?: string;
  } | undefined;
  const neckLabel = prior.apliiqPrivateLabelSnapshot?.neckLabel as {
    subscription?: string;
  } | undefined;
  return prior.apliiqProductId === String(current.designId)
    && prior.apliiqSku === current.sku
    && front?.apliiqArtworkId === current.artworkId
    && front?.artworkUrl === current.artworkUrl
    && front?.service === current.service
    && front?.note === current.printNote
    && neckLabel?.subscription === current.privateLabel
    && prior.apliiqSizeGuideReference === current.sizeGuideId;
}

/**
 * Prior statuses carry only for an exact committed variant identity. Otherwise
 * the product-level approval fingerprint must bind both human approvals to the
 * complete current design and all of its variants.
 */
export function resolveCapsuleVariantApprovals(
  slug: string,
  variantId: string,
  prior: ApliiqMapEntry | undefined,
  approvals: CapsuleApprovalMetadata | undefined,
  current: CapsuleVariantProductionIdentity,
  expectedFingerprint: string,
): Pick<ApliiqMapEntry, "apliiqMappingApproval" | "apliiqSampleApproval"> {
  if (prior && mapEntryMatchesProductionIdentity(prior, current)) {
    if (prior.apliiqMappingApproval !== "approved" || prior.apliiqSampleApproval !== "approved") {
      throw new Error(`${slug}/${variantId}: prior APLIIQ approvals are not both approved; refusing to replace them. Expected production fingerprint: ${expectedFingerprint}`);
    }
    return {
      apliiqMappingApproval: prior.apliiqMappingApproval,
      apliiqSampleApproval: prior.apliiqSampleApproval,
    };
  }

  try {
    requireExplicitCapsuleApprovals(slug, approvals, expectedFingerprint);
  } catch (error) {
    if (prior) {
      throw new Error(`${slug}/${variantId}: prior approval identity does not match the current immutable production design; explicit dated, identity-bound mapping and sample approvals are required (${error instanceof Error ? error.message : String(error)})`);
    }
    throw error;
  }
  return { apliiqMappingApproval: "approved", apliiqSampleApproval: "approved" };
}
