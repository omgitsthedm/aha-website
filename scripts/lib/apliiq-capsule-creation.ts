import { createHash } from "node:crypto";

export interface CapsuleCreationProduct {
  slug: string;
  title: string;
  productCode: string;
  frontLocationId: number;
  artworkUrl: string;
  mockupUrl: string;
  printNote: string;
}

export interface CapsuleCreationSpec {
  colorId: number;
  service: string;
}

export interface DesignVariant {
  sku: string;
  size: string;
  weight: string;
  plusSizeFee: number;
}

export type CreationStatus = "artwork-pending" | "artwork-created" | "design-pending" | "design-created";

interface CreationMetadata {
  version: 2;
  specFingerprint: string;
  status: CreationStatus;
}

export interface ApliiqProductionIdentity {
  version: 1;
  slug: string;
  productCode: string;
  colorId: number;
  frontLocationId: number;
  artworkUrl: string;
  artworkId: number;
  service: string;
  printNote: string;
  designId: number;
  variants: Array<{ size: string; sku: string }>;
  fingerprint: string;
}

export interface DesignRecord {
  artworkId: number;
  designId: number;
  productCode: string;
  colorId: number;
  apliiqMockupPath: string;
  variants: DesignVariant[];
  _creation: CreationMetadata;
  _identity: ApliiqProductionIdentity;
}

export interface CreationCheckpoint {
  artworkId?: number;
  _creation: CreationMetadata;
}

export type DesignCreationState = DesignRecord | CreationCheckpoint;

type ProviderCall = (method: "POST", path: "/Artwork" | "/Design", body: unknown) => Promise<unknown>;
type PersistCheckpoint = (state: DesignCreationState) => void;

type IdentityRecordFields = Pick<DesignRecord, "artworkId" | "designId" | "variants">;

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function positiveProviderId(value: unknown, label: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`APLIIQ ${label} response did not contain a valid Id; creation state is ambiguous and must be reconciled manually`);
  return id;
}

/** Immutable desired production spec. Deliberately excludes the mutable Square/mockup image URL. */
export function capsuleCreationFingerprint(product: CapsuleCreationProduct, spec: CapsuleCreationSpec): string {
  return hash({
    version: 2,
    slug: product.slug,
    productCode: product.productCode,
    colorId: spec.colorId,
    frontLocationId: product.frontLocationId,
    artworkUrl: product.artworkUrl,
    service: spec.service,
    printNote: product.printNote,
  });
}

function identityPayload(
  product: CapsuleCreationProduct,
  spec: CapsuleCreationSpec,
  record: IdentityRecordFields,
): Omit<ApliiqProductionIdentity, "fingerprint"> {
  return {
    version: 1,
    slug: product.slug,
    productCode: product.productCode,
    colorId: spec.colorId,
    frontLocationId: product.frontLocationId,
    artworkUrl: product.artworkUrl,
    artworkId: record.artworkId,
    service: spec.service,
    printNote: product.printNote,
    designId: record.designId,
    variants: record.variants
      .map(({ size, sku }) => ({ size, sku }))
      .sort((left, right) => left.size.localeCompare(right.size) || left.sku.localeCompare(right.sku)),
  };
}

export function buildApliiqProductionIdentity(
  product: CapsuleCreationProduct,
  spec: CapsuleCreationSpec,
  record: IdentityRecordFields,
): ApliiqProductionIdentity {
  const payload = identityPayload(product, spec, record);
  return { ...payload, fingerprint: hash(payload) };
}

export function isCompleteDesignRecord(state: DesignCreationState): state is DesignRecord {
  return Number.isSafeInteger((state as DesignRecord).designId)
    && Array.isArray((state as DesignRecord).variants);
}

/** Fail closed unless the recorded provider objects exactly represent today's immutable production intent. */
export function assertApliiqDesignIdentity(
  product: CapsuleCreationProduct,
  spec: CapsuleCreationSpec,
  state: DesignCreationState,
): void {
  const slug = product.slug;
  const desiredSpecFingerprint = capsuleCreationFingerprint(product, spec);
  if (state._creation?.version !== 2 || state._creation.specFingerprint !== desiredSpecFingerprint) {
    throw new Error(`${slug}: recorded APLIIQ creation state belongs to a different immutable production spec; a new design path and explicit dated approvals are required`);
  }
  if (!isCompleteDesignRecord(state)) return;
  if (!state._identity) {
    throw new Error(`${slug}: recorded APLIIQ design has no audited production identity; refusing to reuse provider records`);
  }
  if (state.productCode !== product.productCode || state.colorId !== spec.colorId) {
    throw new Error(`${slug}: recorded APLIIQ design identity conflicts with its creation checkpoint; refusing to reuse provider records`);
  }
  const expected = buildApliiqProductionIdentity(product, spec, state);
  if (state._identity.fingerprint !== expected.fingerprint || JSON.stringify(state._identity) !== JSON.stringify(expected)) {
    throw new Error(`${slug}: recorded APLIIQ design/artwork/SKU identity does not match the current immutable production spec; a new design path and explicit dated approvals are required`);
  }
}

function checkpoint(fingerprint: string, status: CreationStatus, artworkId?: number): CreationCheckpoint {
  return {
    ...(artworkId === undefined ? {} : { artworkId }),
    _creation: { version: 2, specFingerprint: fingerprint, status },
  };
}

export async function createOrResumeApliiqDesign(input: {
  product: CapsuleCreationProduct;
  spec: CapsuleCreationSpec;
  existing?: DesignCreationState;
  persist: PersistCheckpoint;
  callProvider: ProviderCall;
}): Promise<{ record: DesignRecord; created: boolean }> {
  const { product, spec, persist, callProvider } = input;
  const fingerprint = capsuleCreationFingerprint(product, spec);
  let state = input.existing;

  if (state) {
    assertApliiqDesignIdentity(product, spec, state);
    if (isCompleteDesignRecord(state)) return { record: state, created: false };
    if (state._creation.status === "artwork-pending" || state._creation.status === "design-pending") {
      throw new Error(`${product.slug}: APLIIQ ${state._creation.status} checkpoint has an unknown provider outcome; reconcile it manually before retrying`);
    }
  }

  let artworkId: number;
  if (state?._creation.status === "artwork-created") {
    artworkId = positiveProviderId(state.artworkId, "artwork checkpoint");
  } else {
    persist(checkpoint(fingerprint, "artwork-pending"));
    const artwork = await callProvider("POST", "/Artwork", {
      Name: `AHA ${product.title}`.slice(0, 50),
      ImagePath: product.artworkUrl,
    }) as Record<string, unknown>;
    artworkId = positiveProviderId(artwork?.Id, "Artwork");
    state = checkpoint(fingerprint, "artwork-created", artworkId);
    persist(state);
  }

  persist(checkpoint(fingerprint, "design-pending", artworkId));
  const design = await callProvider("POST", "/Design", {
    ProductCode: product.productCode,
    ColorId: spec.colorId,
    Name: `AHA ${product.title}`,
    Description: `${product.title} — After Hours Agenda`,
    Locations: [{
      Id: product.frontLocationId,
      ImagePath: product.mockupUrl,
      Artworks: [{ Service: spec.service, Note: product.printNote, Id: artworkId }],
    }],
    Subscriptions: [],
  }) as Record<string, unknown>;
  const designId = positiveProviderId(design?.Id, "Design");
  if (String(design.ProductCode) !== product.productCode || Number(design.ColorId) !== spec.colorId) {
    throw new Error("APLIIQ Design response does not match the requested product identity; creation state is ambiguous and must be reconciled manually");
  }
  if (!Array.isArray(design.Variants)) {
    throw new Error("APLIIQ Design response did not contain Variants; creation state is ambiguous and must be reconciled manually");
  }

  const recordFields = {
    artworkId,
    designId,
    variants: (design.Variants as Record<string, unknown>[]).map((variant) => ({
      sku: String(variant.SKU),
      size: String(variant.Name),
      weight: String(variant.Weight),
      plusSizeFee: Number(variant.PlusSize_Fee ?? 0),
    })),
  };
  const record: DesignRecord = {
    ...recordFields,
    productCode: String(design.ProductCode),
    colorId: Number(design.ColorId),
    apliiqMockupPath: String((design.Locations as Record<string, unknown>[] | undefined)?.[0]?.ImagePath ?? ""),
    _creation: { version: 2, specFingerprint: fingerprint, status: "design-created" },
    _identity: buildApliiqProductionIdentity(product, spec, recordFields),
  };
  persist(record);
  return { record, created: true };
}
