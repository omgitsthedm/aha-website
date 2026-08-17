/**
 * Fail-closed planning helpers for the final AHA Square catalog reset.
 *
 * This is intentionally separate from square-catalog-archive.ts: that
 * original one-time workflow keeps its immutable 118-merchandise snapshot
 * and its two protected service records unchanged. This second step only runs
 * after the original archive is complete and archives those two exact records.
 */
import {
  type ArchiveSnapshot,
  type PreservedService,
  type SquareCatalogItem,
  buildArchivePlan,
  validateArchiveResponse,
  validateExactCandidate,
} from "./square-catalog-archive";

export const FINAL_RESET_ARCHIVED_ITEM_COUNT = 120;
export const FINAL_RESET_ACTIVE_ITEM_COUNT = 0;

function fail(message: string): never {
  throw new Error(`Square final catalog reset refused: ${message}`);
}

function catalogItemsById(objects: SquareCatalogItem[], label: string): Map<string, SquareCatalogItem> {
  const items = objects.filter((object) => object.type === "ITEM");
  const byId = new Map(items.map((item) => [item.id, item]));
  if (byId.size !== items.length) fail(`${label} catalog returned duplicate ITEM IDs.`);
  return byId;
}

function activeCatalogItems(objects: SquareCatalogItem[]): SquareCatalogItem[] {
  return objects.filter((item) => item.type === "ITEM" && item.is_deleted !== true && item.item_data?.is_archived !== true);
}

function validateRecordIntegrity(
  actual: SquareCatalogItem,
  expected: PreservedService | { id: string; name: string; version: number; variation_count: number },
  label: string,
): void {
  if (actual.id !== expected.id || actual.type !== "ITEM") {
    fail(`${label} ${expected.id} is missing or is not an ITEM.`);
  }
  if (actual.is_deleted === true) fail(`${label} ${expected.id} is already deleted.`);
  if (actual.item_data?.name !== expected.name) {
    fail(`${label} ${expected.id} name drift: expected ${JSON.stringify(expected.name)}, got ${JSON.stringify(actual.item_data?.name)}.`);
  }
  if ((actual.item_data?.variations?.length ?? 0) !== expected.variation_count) {
    fail(`${label} ${expected.id} variation-count drift: expected ${expected.variation_count}, got ${actual.item_data?.variations?.length ?? 0}.`);
  }
  if ("product_type" in expected && actual.item_data?.product_type !== expected.product_type) {
    fail(`${label} ${expected.id} product-type drift: expected ${expected.product_type}, got ${actual.item_data?.product_type ?? "undefined"}.`);
  }
}

function validateArchivedRecord(
  actual: SquareCatalogItem,
  expected: PreservedService | { id: string; name: string; version: number; variation_count: number },
  label: string,
): void {
  validateRecordIntegrity(actual, expected, label);
  if (actual.is_deleted === true) fail(`${label} ${expected.id} was deleted instead of archived.`);
  if (actual.item_data?.is_archived !== true) fail(`${label} ${expected.id} is not archived.`);
  if (actual.version < expected.version) {
    fail(`${label} ${expected.id} version regressed below snapshot ${expected.version}: got ${actual.version}.`);
  }
}

export interface FinalResetPreflight {
  outstandingServices: PreservedService[];
  alreadyArchivedServices: PreservedService[];
}

/**
 * Permits the second archive step only when the original frozen 118-item
 * archive is complete and these two exact services are the only active ITEMs.
 */
export function validateFinalResetPreflight(
  snapshot: ArchiveSnapshot,
  objects: SquareCatalogItem[],
): FinalResetPreflight {
  const { candidates, preservedServices } = buildArchivePlan(snapshot);
  const byId = catalogItemsById(objects, "preflight");

  for (const candidate of candidates) {
    const actual = byId.get(candidate.id);
    if (!actual) fail(`legacy target ${candidate.id} is missing from the catalog.`);
    validateRecordIntegrity(actual, candidate, "legacy target");
    if (actual.item_data?.product_type === "LEGACY_SQUARE_ONLINE_SERVICE") {
      fail(`legacy target ${candidate.id} entered the protected service product type.`);
    }
    if (actual.item_data?.is_archived !== true) {
      fail(`the original 118-item archive is incomplete: legacy target ${candidate.id} remains active.`);
    }
    if (actual.version < candidate.version) {
      fail(`legacy target ${candidate.id} version regressed below snapshot ${candidate.version}: got ${actual.version}.`);
    }
  }

  const outstandingServices: PreservedService[] = [];
  const alreadyArchivedServices: PreservedService[] = [];
  for (const service of preservedServices) {
    const actual = byId.get(service.id);
    if (!actual) fail(`final-reset service ${service.id} is missing from the catalog.`);
    validateRecordIntegrity(actual, service, "final-reset service");

    if (actual.item_data?.is_archived === true) {
      if (actual.version < service.version) {
        fail(`archived final-reset service ${service.id} version regressed below snapshot ${service.version}: got ${actual.version}.`);
      }
      alreadyArchivedServices.push(service);
      continue;
    }
    if (actual.version !== service.version) {
      fail(`active final-reset service ${service.id} version drift: expected ${service.version}, got ${actual.version}.`);
    }
    outstandingServices.push(service);
  }

  const activeItems = activeCatalogItems(objects);
  const outstandingIds = new Set(outstandingServices.map((service) => service.id));
  const unexpectedActive = activeItems.filter((item) => !outstandingIds.has(item.id));
  if (unexpectedActive.length > 0) {
    fail(`preflight found unexpected active ITEMs: ${unexpectedActive.map((item) => `${item.id} (${item.item_data?.name ?? "unnamed"})`).join(", ")}.`);
  }
  if (activeItems.length !== outstandingServices.length) {
    fail(`active ITEM count is ${activeItems.length}, expected ${outstandingServices.length} outstanding final-reset services.`);
  }

  return { outstandingServices, alreadyArchivedServices };
}

/** Validates the fresh retrieve made immediately before each service archive. */
export function validateExactFinalResetService(actual: SquareCatalogItem, expected: PreservedService): void {
  validateExactCandidate(actual, expected);
  if (actual.item_data?.product_type !== expected.product_type) {
    fail(`service ${expected.id} product-type drift: expected ${expected.product_type}, got ${actual.item_data?.product_type ?? "undefined"}.`);
  }
}

/** Ensures Square confirmed the archival update without changing service identity. */
export function validateFinalResetArchiveResponse(actual: SquareCatalogItem | undefined, expected: PreservedService): void {
  validateArchiveResponse(actual, expected);
  if (actual?.item_data?.product_type !== expected.product_type) {
    fail(`Square changed product type while archiving service ${expected.id}.`);
  }
  if (actual.version <= expected.version) {
    fail(`Square did not advance the version while archiving service ${expected.id}.`);
  }
  if ((actual.item_data?.variations?.length ?? 0) !== expected.variation_count) {
    fail(`Square changed variation count while archiving service ${expected.id}.`);
  }
}

/**
 * Proves the terminal catalog state: every snapshot ITEM is archived and no
 * active ITEM remains. Deleted records are deliberately rejected for all 120
 * snapshot IDs; this operation must remain an archive, not a deletion.
 */
export function validateFinalResetPostflight(snapshot: ArchiveSnapshot, objects: SquareCatalogItem[]): void {
  const { candidates, preservedServices } = buildArchivePlan(snapshot);
  if (candidates.length + preservedServices.length !== FINAL_RESET_ARCHIVED_ITEM_COUNT) {
    fail(`snapshot target count is ${candidates.length + preservedServices.length}, expected ${FINAL_RESET_ARCHIVED_ITEM_COUNT}.`);
  }

  const byId = catalogItemsById(objects, "postflight");
  for (const candidate of candidates) {
    const actual = byId.get(candidate.id);
    if (!actual) fail(`postflight target ${candidate.id} is missing from the catalog.`);
    validateArchivedRecord(actual, candidate, "postflight target");
  }
  for (const service of preservedServices) {
    const actual = byId.get(service.id);
    if (!actual) fail(`postflight service ${service.id} is missing from the catalog.`);
    validateArchivedRecord(actual, service, "postflight service");
  }

  const activeItems = activeCatalogItems(objects);
  if (activeItems.length !== FINAL_RESET_ACTIVE_ITEM_COUNT) {
    fail(`postflight found ${activeItems.length} active ITEM(s): ${activeItems.map((item) => `${item.id} (${item.item_data?.name ?? "unnamed"})`).join(", ")}.`);
  }
}
