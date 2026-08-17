import { describe, expect, it } from "vitest";
import {
  type ArchiveSnapshot,
  type SquareCatalogItem,
} from "@/scripts/lib/square-catalog-archive";
import {
  FINAL_RESET_ARCHIVED_ITEM_COUNT,
  validateExactFinalResetService,
  validateFinalResetArchiveResponse,
  validateFinalResetPostflight,
  validateFinalResetPreflight,
} from "@/scripts/lib/square-catalog-final-reset";

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

function snapshot(): ArchiveSnapshot {
  return {
    archive_candidate_count: 118,
    archive_candidates: Array.from({ length: 118 }, (_, index) => ({ ...candidate, id: `MERCH-${index + 1}` })),
    preserve_count: 2,
    preserve_items: [service, { ...service, id: "SERVICE-2", name: "Discount" }],
    snapshot_counts: { total_items: 242, already_deleted: 122, active: 120 },
  };
}

function item(
  source: typeof candidate | typeof service,
  overrides: Partial<SquareCatalogItem> = {},
): SquareCatalogItem {
  return {
    id: source.id,
    type: "ITEM",
    version: source.version,
    is_deleted: false,
    item_data: {
      name: source.name,
      product_type: "product_type" in source ? source.product_type : "REGULAR",
      variations: [{ id: "VAR-1", version: source.version }],
    },
    ...overrides,
  };
}

function completedLegacyArchive(source: ArchiveSnapshot): SquareCatalogItem[] {
  return [
    ...source.archive_candidates.map((entry) => item(entry, {
      version: entry.version + 1,
      item_data: {
        name: entry.name,
        product_type: "REGULAR",
        is_archived: true,
        variations: [{ id: "VAR-1" }],
      },
    })),
    ...source.preserve_items.map((entry) => item(entry)),
  ];
}

function completedFinalReset(source: ArchiveSnapshot): SquareCatalogItem[] {
  return completedLegacyArchive(source).map((entry) => ({
    ...entry,
    version: entry.version + 1,
    item_data: { ...entry.item_data, is_archived: true },
  }));
}

describe("Square final catalog reset guard", () => {
  it("permits only the two preserved services after all 118 frozen merchandise items are archived", () => {
    const frozen = snapshot();
    const result = validateFinalResetPreflight(frozen, completedLegacyArchive(frozen));
    expect(result.outstandingServices.map((entry) => entry.id)).toEqual(["SERVICE-1", "SERVICE-2"]);
    expect(result.alreadyArchivedServices).toEqual([]);
  });

  it("resumes safely when one final service was already archived by an interrupted run", () => {
    const frozen = snapshot();
    const catalog = completedLegacyArchive(frozen);
    catalog.at(-1)!.item_data!.is_archived = true;
    catalog.at(-1)!.version += 1;

    const result = validateFinalResetPreflight(frozen, catalog);
    expect(result.outstandingServices.map((entry) => entry.id)).toEqual(["SERVICE-1"]);
    expect(result.alreadyArchivedServices.map((entry) => entry.id)).toEqual(["SERVICE-2"]);
  });

  it("refuses deleted, drifted, or version-regressed final services during resume", () => {
    const frozen = snapshot();
    const lowerVersion = completedLegacyArchive(frozen);
    lowerVersion.at(-1)!.item_data!.is_archived = true;
    lowerVersion.at(-1)!.version = frozen.preserve_items[1].version - 1;
    expect(() => validateFinalResetPreflight(frozen, lowerVersion)).toThrow(/version regressed below snapshot/);

    const deleted = completedLegacyArchive(frozen);
    deleted.at(-1)!.is_deleted = true;
    expect(() => validateFinalResetPreflight(frozen, deleted)).toThrow(/already deleted/);

    const renamed = completedLegacyArchive(frozen);
    renamed.at(-1)!.item_data!.name = "Drifted";
    expect(() => validateFinalResetPreflight(frozen, renamed)).toThrow(/name drift/);
  });

  it("refuses final reset while any original merchandise target is still active", () => {
    const frozen = snapshot();
    const catalog = completedLegacyArchive(frozen);
    catalog[0] = item(frozen.archive_candidates[0]);
    expect(() => validateFinalResetPreflight(frozen, catalog)).toThrow(/original 118-item archive is incomplete/);
  });

  it("refuses an unexpected active item before any final service archive", () => {
    const frozen = snapshot();
    const catalog = completedLegacyArchive(frozen);
    catalog.push(item({ ...candidate, id: "NEW-1", name: "Unexpected" }));
    expect(() => validateFinalResetPreflight(frozen, catalog)).toThrow(/unexpected active ITEM/i);
  });

  it("refuses a service whose type drifted after preflight", () => {
    const frozen = snapshot();
    const drifted = item(frozen.preserve_items[0], {
      item_data: { name: "Billable Hour", product_type: "REGULAR", variations: [{ id: "VAR-1" }] },
    });
    expect(() => validateExactFinalResetService(drifted, frozen.preserve_items[0])).toThrow(/product-type drift/);
  });

  it("requires the archive response to advance version without changing variations", () => {
    const frozen = snapshot();
    const expected = frozen.preserve_items[0];
    const archived = item(expected, {
      version: expected.version + 1,
      item_data: {
        name: expected.name,
        product_type: expected.product_type,
        is_archived: true,
        variations: [{ id: "VAR-1" }],
      },
    });
    expect(() => validateFinalResetArchiveResponse(archived, expected)).not.toThrow();

    expect(() => validateFinalResetArchiveResponse({ ...archived, version: expected.version }, expected)).toThrow(/did not advance/);
    expect(() => validateFinalResetArchiveResponse({
      ...archived,
      item_data: { ...archived.item_data, variations: [] },
    }, expected)).toThrow(/changed variation count/);
  });

  it("proves all 120 frozen ITEMs archived and zero remain active", () => {
    const frozen = snapshot();
    const catalog = completedFinalReset(frozen);
    expect(catalog).toHaveLength(FINAL_RESET_ARCHIVED_ITEM_COUNT);
    expect(() => validateFinalResetPostflight(frozen, catalog)).not.toThrow();
  });

  it("refuses an unarchived final service, unexpected active item, or deleted final target postflight", () => {
    const frozen = snapshot();
    const activeService = completedFinalReset(frozen);
    activeService.at(-1)!.item_data!.is_archived = false;
    expect(() => validateFinalResetPostflight(frozen, activeService)).toThrow(/postflight service.*not archived/);

    const unexpectedActive = completedFinalReset(frozen);
    unexpectedActive.push(item({ ...candidate, id: "NEW-1", name: "Unexpected" }));
    expect(() => validateFinalResetPostflight(frozen, unexpectedActive)).toThrow(/active ITEM/);

    const deletedTarget = completedFinalReset(frozen);
    deletedTarget[0].is_deleted = true;
    expect(() => validateFinalResetPostflight(frozen, deletedTarget)).toThrow(/already deleted/);
  });
});
