/**
 * Pure planning and validation helpers for the one-time legacy Square catalog
 * archive. The executable wrapper owns credentials and network I/O; keeping
 * these helpers pure makes the fail-closed rules testable without Square access.
 */

export const SQUARE_ARCHIVE_API_VERSION = "2026-07-15";
export const EXPECTED_ARCHIVE_CANDIDATE_COUNT = 118;
export const EXPECTED_PRESERVE_COUNT = 2;

export interface ArchiveCandidate {
  id: string;
  name: string;
  version: number;
  updated_at: string;
  variation_count: number;
}

export interface PreservedService extends ArchiveCandidate {
  product_type: "LEGACY_SQUARE_ONLINE_SERVICE";
}

export interface ArchiveSnapshot {
  archive_candidate_count: number;
  archive_candidates: ArchiveCandidate[];
  preserve_count: number;
  preserve_items: PreservedService[];
  snapshot_counts: {
    total_items: number;
    already_deleted: number;
    active: number;
  };
}

export interface SquareCatalogItem {
  id: string;
  type: string;
  version: number;
  updated_at?: string;
  is_deleted?: boolean;
  item_data?: {
    name?: string;
    product_type?: string;
    is_archived?: boolean;
    variations?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function fail(message: string): never {
  throw new Error(`Square catalog archive refused: ${message}`);
}

function assertUniqueIds(entries: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id) fail(`${label} contains an empty catalog ID.`);
    if (ids.has(entry.id)) fail(`${label} contains duplicate ID ${entry.id}.`);
    ids.add(entry.id);
  }
}

/** Validates the immutable snapshot itself before any Square request is made. */
export function buildArchivePlan(snapshot: ArchiveSnapshot): {
  candidates: ArchiveCandidate[];
  preservedServices: PreservedService[];
} {
  if (snapshot.archive_candidate_count !== EXPECTED_ARCHIVE_CANDIDATE_COUNT) {
    fail(`snapshot archive_candidate_count is ${snapshot.archive_candidate_count}, expected ${EXPECTED_ARCHIVE_CANDIDATE_COUNT}.`);
  }
  if (snapshot.archive_candidates.length !== EXPECTED_ARCHIVE_CANDIDATE_COUNT) {
    fail(`snapshot contains ${snapshot.archive_candidates.length} archive candidates, expected ${EXPECTED_ARCHIVE_CANDIDATE_COUNT}.`);
  }
  if (snapshot.preserve_count !== EXPECTED_PRESERVE_COUNT || snapshot.preserve_items.length !== EXPECTED_PRESERVE_COUNT) {
    fail(`snapshot preserves ${snapshot.preserve_items.length} service item(s), expected ${EXPECTED_PRESERVE_COUNT}.`);
  }
  if (snapshot.snapshot_counts.active !== EXPECTED_ARCHIVE_CANDIDATE_COUNT + EXPECTED_PRESERVE_COUNT) {
    fail(`snapshot active count is ${snapshot.snapshot_counts.active}, expected ${EXPECTED_ARCHIVE_CANDIDATE_COUNT + EXPECTED_PRESERVE_COUNT}.`);
  }

  assertUniqueIds(snapshot.archive_candidates, "archive candidates");
  assertUniqueIds(snapshot.preserve_items, "preserved services");
  const candidateIds = new Set(snapshot.archive_candidates.map((candidate) => candidate.id));
  for (const service of snapshot.preserve_items) {
    if (candidateIds.has(service.id)) fail(`protected service ${service.id} appears in the archive target.`);
    if (service.product_type !== "LEGACY_SQUARE_ONLINE_SERVICE") {
      fail(`protected item ${service.id} is not a LEGACY_SQUARE_ONLINE_SERVICE.`);
    }
  }

  return { candidates: snapshot.archive_candidates, preservedServices: snapshot.preserve_items };
}

function validateCandidateIntegrity(
  actual: SquareCatalogItem,
  expected: ArchiveCandidate,
  label: string,
): void {
  if (actual.type !== "ITEM") fail(`${label} ${expected.id} is type ${actual.type}, not ITEM.`);
  if (actual.id !== expected.id) fail(`${label} ID drift: expected ${expected.id}, got ${actual.id}.`);
  if (actual.is_deleted === true) fail(`${label} ${expected.id} is already deleted.`);
  if (actual.item_data?.name !== expected.name) {
    fail(`${label} ${expected.id} name drift: expected ${JSON.stringify(expected.name)}, got ${JSON.stringify(actual.item_data?.name)}.`);
  }
  if ((actual.item_data?.variations?.length ?? 0) !== expected.variation_count) {
    fail(`${label} ${expected.id} variation-count drift: expected ${expected.variation_count}, got ${actual.item_data?.variations?.length ?? 0}.`);
  }
}

function validateSnapshotRecord(
  actual: SquareCatalogItem,
  expected: ArchiveCandidate,
  label: string,
): void {
  validateCandidateIntegrity(actual, expected, label);
  if (actual.version !== expected.version) {
    fail(`${label} ${expected.id} version drift: expected ${expected.version}, got ${actual.version}.`);
  }
}

export interface ArchivePreflight {
  outstandingCandidates: ArchiveCandidate[];
  alreadyArchivedCandidates: ArchiveCandidate[];
}

/**
 * Validates the full live catalog before the first mutation. Active items must
 * be exactly the frozen targets plus the two protected Square service records.
 */
export function validatePreflightCatalog(
  snapshot: ArchiveSnapshot,
  objects: SquareCatalogItem[],
): ArchivePreflight {
  const { candidates, preservedServices } = buildArchivePlan(snapshot);
  const items = objects.filter((object) => object.type === "ITEM");
  const byId = new Map(items.map((object) => [object.id, object]));
  if (byId.size !== items.length) fail("live catalog returned duplicate ITEM IDs.");

  const outstandingCandidates: ArchiveCandidate[] = [];
  const alreadyArchivedCandidates: ArchiveCandidate[] = [];

  for (const candidate of candidates) {
    const actual = byId.get(candidate.id);
    if (!actual) fail(`candidate ${candidate.id} is missing from the catalog.`);
    validateCandidateIntegrity(actual, candidate, "candidate");
    if (actual.item_data?.product_type === "LEGACY_SQUARE_ONLINE_SERVICE") {
      fail(`candidate ${candidate.id} entered the protected service product type.`);
    }
    if (actual.item_data?.is_archived === true) {
      if (actual.version < candidate.version) {
        fail(`archived candidate ${candidate.id} version regressed below snapshot ${candidate.version}: got ${actual.version}.`);
      }
      alreadyArchivedCandidates.push(candidate);
    } else {
      if (actual.version !== candidate.version) {
        fail(`active candidate ${candidate.id} version drift: expected ${candidate.version}, got ${actual.version}.`);
      }
      outstandingCandidates.push(candidate);
    }
  }
  for (const service of preservedServices) {
    const actual = byId.get(service.id);
    if (!actual) fail(`protected service ${service.id} is missing from the catalog.`);
    validateSnapshotRecord(actual, service, "protected service");
    if (actual.item_data?.is_archived === true) fail(`protected service ${service.id} is archived.`);
    if (actual.item_data?.product_type !== service.product_type) {
      fail(`protected service ${service.id} product-type drift: expected ${service.product_type}, got ${actual.item_data?.product_type ?? "undefined"}.`);
    }
  }

  const activeItems = items.filter((item) => item.is_deleted !== true && item.item_data?.is_archived !== true);
  const allowedIds = new Set([...candidates, ...preservedServices].map((entry) => entry.id));
  const unexpected = activeItems.filter((item) => !allowedIds.has(item.id));
  if (unexpected.length > 0) {
    fail(`new active merchandise found since snapshot: ${unexpected.map((item) => `${item.id} (${item.item_data?.name ?? "unnamed"})`).join(", ")}.`);
  }
  const expectedActiveCount = outstandingCandidates.length + EXPECTED_PRESERVE_COUNT;
  if (activeItems.length !== expectedActiveCount) {
    fail(`live active item count is ${activeItems.length}, expected ${expectedActiveCount} outstanding targets and protected services.`);
  }

  return { outstandingCandidates, alreadyArchivedCandidates };
}

/**
 * Proves the final Square state from a new whole-catalog read. Every target
 * must still exist as an archived (recoverable) ITEM, both protected service
 * records must remain untouched and active, and nothing else may be active.
 */
export function validatePostflightCatalog(
  snapshot: ArchiveSnapshot,
  objects: SquareCatalogItem[],
): void {
  const { candidates, preservedServices } = buildArchivePlan(snapshot);
  const items = objects.filter((object) => object.type === "ITEM");
  const byId = new Map(items.map((object) => [object.id, object]));
  if (byId.size !== items.length) fail("postflight catalog returned duplicate ITEM IDs.");

  for (const candidate of candidates) {
    const actual = byId.get(candidate.id);
    if (!actual) fail(`postflight target ${candidate.id} is missing from the catalog.`);
    if (actual.is_deleted === true) fail(`postflight target ${candidate.id} was deleted instead of archived.`);
    if (actual.item_data?.is_archived !== true) fail(`postflight target ${candidate.id} is not archived.`);
    if (actual.item_data?.name !== candidate.name) {
      fail(`postflight target ${candidate.id} name drift: expected ${JSON.stringify(candidate.name)}, got ${JSON.stringify(actual.item_data?.name)}.`);
    }
    if (actual.version < candidate.version) {
      fail(`postflight target ${candidate.id} version regressed below snapshot ${candidate.version}: got ${actual.version}.`);
    }
    if ((actual.item_data?.variations?.length ?? 0) !== candidate.variation_count) {
      fail(`postflight target ${candidate.id} variation-count drift: expected ${candidate.variation_count}, got ${actual.item_data?.variations?.length ?? 0}.`);
    }
  }

  for (const service of preservedServices) {
    const actual = byId.get(service.id);
    if (!actual) fail(`postflight protected service ${service.id} is missing from the catalog.`);
    validateSnapshotRecord(actual, service, "postflight protected service");
    if (actual.item_data?.is_archived === true) fail(`postflight protected service ${service.id} was archived.`);
    if (actual.item_data?.product_type !== service.product_type) {
      fail(`postflight protected service ${service.id} product-type drift: expected ${service.product_type}, got ${actual.item_data?.product_type ?? "undefined"}.`);
    }
  }

  const protectedIds = new Set(preservedServices.map((service) => service.id));
  const activeItems = items.filter((item) => item.is_deleted !== true && item.item_data?.is_archived !== true);
  const unexpectedActive = activeItems.filter((item) => !protectedIds.has(item.id));
  if (unexpectedActive.length > 0) {
    fail(`postflight found unexpected active merchandise: ${unexpectedActive.map((item) => `${item.id} (${item.item_data?.name ?? "unnamed"})`).join(", ")}.`);
  }
  if (activeItems.length !== EXPECTED_PRESERVE_COUNT) {
    fail(`postflight active item count is ${activeItems.length}, expected ${EXPECTED_PRESERVE_COUNT} protected services.`);
  }
}

/** Validates the exact object fetched immediately before its archive mutation. */
export function validateExactCandidate(actual: SquareCatalogItem, expected: ArchiveCandidate): void {
  validateSnapshotRecord(actual, expected, "candidate");
  if (actual.item_data?.is_archived === true) fail(`candidate ${expected.id} is already archived.`);
}

function stripReadOnlyCatalogFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripReadOnlyCatalogFields);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["updated_at", "created_at", "is_deleted", "catalog_v1_ids"].includes(key))
      .map(([key, nested]) => [key, stripReadOnlyCatalogFields(nested)]),
  );
}

/**
 * Square archives an ITEM through UpsertCatalogObject. This keeps the full,
 * freshly fetched writable object and its Square-issued version, changing only
 * item_data.is_archived. It deliberately does not use delete endpoints.
 */
export function buildArchivedCatalogObject(actual: SquareCatalogItem): SquareCatalogItem {
  if (actual.type !== "ITEM" || !actual.item_data) fail(`cannot archive non-ITEM object ${actual.id}.`);
  const cleaned = stripReadOnlyCatalogFields(actual) as SquareCatalogItem;
  return {
    ...cleaned,
    item_data: {
      ...cleaned.item_data,
      is_archived: true,
    },
  };
}

export function validateArchiveResponse(actual: SquareCatalogItem | undefined, expected: ArchiveCandidate): void {
  if (!actual) fail(`Square returned no catalog object while archiving ${expected.id}.`);
  if (actual.id !== expected.id || actual.type !== "ITEM") fail(`Square returned an unexpected object for ${expected.id}.`);
  if (actual.is_deleted === true || actual.item_data?.is_archived !== true) {
    fail(`Square did not confirm archived state for ${expected.id}.`);
  }
  if (actual.item_data?.name !== expected.name) fail(`Square changed name while archiving ${expected.id}.`);
}
