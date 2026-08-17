import { describe, expect, it } from "vitest";
import {
  EXPECTED_ARCHIVE_CANDIDATE_COUNT,
  type ArchiveSnapshot,
  type SquareCatalogItem,
  buildArchivePlan,
  buildArchivedCatalogObject,
  validateExactCandidate,
  validatePostflightCatalog,
  validatePreflightCatalog,
} from "@/scripts/lib/square-catalog-archive";

const candidate = {
  id: "MERCH-1",
  name: "Legacy Shirt",
  version: 100,
  updated_at: "2026-08-16T00:00:00.000Z",
  variation_count: 1,
};

const service = {
  id: "SERVICE-1",
  name: "Billable Hour",
  version: 101,
  updated_at: "2026-08-16T00:00:00.000Z",
  variation_count: 1,
  product_type: "LEGACY_SQUARE_ONLINE_SERVICE" as const,
};

function item(source: typeof candidate | typeof service, overrides: Partial<SquareCatalogItem> = {}): SquareCatalogItem {
  return {
    id: source.id,
    type: "ITEM",
    version: source.version,
    is_deleted: false,
    updated_at: source.updated_at,
    item_data: {
      name: source.name,
      product_type: "product_type" in source ? source.product_type : "REGULAR",
      variations: [{ id: "VAR-1", version: source.version, is_deleted: false, updated_at: source.updated_at }],
    },
    ...overrides,
  };
}

function snapshot(): ArchiveSnapshot {
  const candidates = Array.from({ length: EXPECTED_ARCHIVE_CANDIDATE_COUNT }, (_, index) => ({
    ...candidate,
    id: `MERCH-${index + 1}`,
  }));
  return {
    archive_candidate_count: EXPECTED_ARCHIVE_CANDIDATE_COUNT,
    archive_candidates: candidates,
    preserve_count: 2,
    preserve_items: [service, { ...service, id: "SERVICE-2", name: "Discount" }],
    snapshot_counts: { total_items: 242, already_deleted: 122, active: 120 },
  };
}

function matchingCatalog(source: ArchiveSnapshot): SquareCatalogItem[] {
  return [
    ...source.archive_candidates.map((entry) => item(entry)),
    ...source.preserve_items.map((entry) => item(entry)),
  ];
}

function matchingPostflightCatalog(source: ArchiveSnapshot): SquareCatalogItem[] {
  return [
    ...source.archive_candidates.map((entry) => item(entry, {
      version: entry.version + 1,
      item_data: {
        name: entry.name,
        product_type: "REGULAR",
        is_archived: true,
        variations: Array.from({ length: entry.variation_count }, (_, index) => ({ id: `VAR-${index + 1}` })),
      },
    })),
    ...source.preserve_items.map((entry) => item(entry)),
  ];
}

describe("Square legacy catalog archive guard", () => {
  it("accepts only an exact frozen 118-item target plus two protected services", () => {
    const frozen = snapshot();
    const result = validatePreflightCatalog(frozen, matchingCatalog(frozen));
    expect(result.outstandingCandidates).toHaveLength(118);
    expect(result.alreadyArchivedCandidates).toHaveLength(0);
  });

  it("accepts and skips an exact baseline-version candidate that was already archived", () => {
    const frozen = snapshot();
    const partial = matchingCatalog(frozen);
    partial[0] = {
      ...partial[0],
      item_data: { ...partial[0].item_data, is_archived: true },
    };

    const result = validatePreflightCatalog(frozen, partial);
    expect(result.alreadyArchivedCandidates.map((entry) => entry.id)).toEqual(["MERCH-1"]);
    expect(result.outstandingCandidates).toHaveLength(117);
  });

  it("resumes a partial archive by skipping exact, version-advanced archived targets", () => {
    const frozen = snapshot();
    const partial = matchingCatalog(frozen);
    partial[0] = {
      ...partial[0],
      version: frozen.archive_candidates[0].version + 1,
      item_data: { ...partial[0].item_data, is_archived: true },
    };

    const result = validatePreflightCatalog(frozen, partial);
    expect(result.alreadyArchivedCandidates.map((entry) => entry.id)).toEqual(["MERCH-1"]);
    expect(result.outstandingCandidates).toHaveLength(117);
    expect(result.outstandingCandidates.some((entry) => entry.id === "MERCH-1")).toBe(false);
  });

  it("refuses deleted, drifted, or lower-version records when resuming a partial archive", () => {
    const frozen = snapshot();
    const deleted = matchingCatalog(frozen);
    deleted[0] = { ...deleted[0], version: 101, is_deleted: true, item_data: { ...deleted[0].item_data, is_archived: true } };
    expect(() => validatePreflightCatalog(frozen, deleted)).toThrow(/already deleted/);

    const renamed = matchingCatalog(frozen);
    renamed[0] = { ...renamed[0], version: 101, item_data: { ...renamed[0].item_data, name: "Drifted", is_archived: true } };
    expect(() => validatePreflightCatalog(frozen, renamed)).toThrow(/name drift/);

    const lowerVersion = matchingCatalog(frozen);
    lowerVersion[0] = { ...lowerVersion[0], version: 99, item_data: { ...lowerVersion[0].item_data, is_archived: true } };
    expect(() => validatePreflightCatalog(frozen, lowerVersion)).toThrow(/version regressed below snapshot/);
  });

  it("refuses a malformed target count before a request can be made", () => {
    const frozen = snapshot();
    frozen.archive_candidate_count = 117;
    expect(() => buildArchivePlan(frozen)).toThrow(/expected 118/);
  });

  it("refuses new active merchandise", () => {
    const frozen = snapshot();
    expect(() => validatePreflightCatalog(frozen, [
      ...matchingCatalog(frozen),
      item({ ...candidate, id: "NEW-1", name: "New product" }),
    ])).toThrow(/new active merchandise/i);
  });

  it("refuses candidate version, deleted-state, and name drift", () => {
    expect(() => validateExactCandidate(item({ ...candidate, id: "WRONG-ID" }), candidate)).toThrow(/ID drift/);
    expect(() => validateExactCandidate(item(candidate, { version: 999 }), candidate)).toThrow(/version drift/);
    expect(() => validateExactCandidate(item(candidate, { is_deleted: true }), candidate)).toThrow(/already deleted/);
    expect(() => validateExactCandidate(item(candidate, { item_data: { name: "Renamed", variations: [{}] } }), candidate)).toThrow(/name drift/);
  });

  it("never permits a protected service in the target", () => {
    const frozen = snapshot();
    frozen.archive_candidates[0] = { ...candidate, id: frozen.preserve_items[0].id };
    expect(() => buildArchivePlan(frozen)).toThrow(/protected service.*target/i);
  });

  it("proves all targets archived and the two protected services still active", () => {
    const frozen = snapshot();
    expect(() => validatePostflightCatalog(frozen, matchingPostflightCatalog(frozen))).not.toThrow();
  });

  it("accepts an exact baseline-version archived target at postflight", () => {
    const frozen = snapshot();
    const catalog = matchingPostflightCatalog(frozen);
    catalog[0] = { ...catalog[0], version: frozen.archive_candidates[0].version };
    expect(() => validatePostflightCatalog(frozen, catalog)).not.toThrow();
  });

  it("refuses a deleted or still-active postflight target", () => {
    const frozen = snapshot();
    const deleted = matchingPostflightCatalog(frozen);
    deleted[0] = { ...deleted[0], is_deleted: true };
    expect(() => validatePostflightCatalog(frozen, deleted)).toThrow(/deleted instead of archived/);

    const active = matchingPostflightCatalog(frozen);
    active[0] = { ...active[0], item_data: { ...active[0].item_data, is_archived: false } };
    expect(() => validatePostflightCatalog(frozen, active)).toThrow(/is not archived/);
  });

  it("refuses an archived protected service or unexpected active merchandise postflight", () => {
    const frozen = snapshot();
    const archivedService = matchingPostflightCatalog(frozen);
    archivedService.at(-1)!.item_data!.is_archived = true;
    expect(() => validatePostflightCatalog(frozen, archivedService)).toThrow(/protected service.*archived/);

    const extraActive = matchingPostflightCatalog(frozen);
    extraActive.push(item({ ...candidate, id: "NEW-POSTFLIGHT", name: "New product" }));
    expect(() => validatePostflightCatalog(frozen, extraActive)).toThrow(/unexpected active merchandise/);
  });

  it("builds a full versioned archive update while stripping only read-only audit fields", () => {
    const source = item(candidate, {
      created_at: candidate.updated_at,
      catalog_v1_ids: [{ catalog_v1_id: "legacy", location_id: "LOC" }],
      item_data: {
        name: candidate.name,
        product_type: "REGULAR",
        description: "Preserve this",
        variations: [{
          id: "VAR-1",
          version: 100,
          updated_at: candidate.updated_at,
          created_at: candidate.updated_at,
          is_deleted: false,
          catalog_v1_ids: [{ catalog_v1_id: "nested", location_id: "LOC" }],
        }],
      },
    });
    const archived = buildArchivedCatalogObject(source);
    expect(archived.version).toBe(candidate.version);
    expect(archived.updated_at).toBeUndefined();
    expect(archived.created_at).toBeUndefined();
    expect(archived.catalog_v1_ids).toBeUndefined();
    expect(archived.is_deleted).toBeUndefined();
    expect(archived.item_data).toMatchObject({ name: candidate.name, description: "Preserve this", is_archived: true });
    expect(archived.item_data?.variations?.[0]).toEqual({ id: "VAR-1", version: 100 });
  });
});
