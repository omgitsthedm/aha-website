// Immutable purchase-time fulfillment reconstruction. Reconciliation must never
// quietly substitute the current catalog for a paid order's provider/art/SKU.
import type { RevalidatedCart, RevalidatedItem } from "./orders";

type JsonRecord = Record<string, unknown>;

export interface PersistedFulfillmentItem {
  ahaProductId: string;
  ahaVariantId: string;
  sku: string;
  titleSnapshot: string;
  sizeSnapshot: string | null;
  colorSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  squareVariationId: string | null;
  printfulCatalogVariantId: number | null;
  fulfillmentProvider: string;
  providerVariantId: string | null;
  providerSku: string | null;
  providerSnapshotJson: unknown;
  printfulPlacementSnapshotJson: unknown;
  printfulFileSnapshotJson: unknown;
}

export class FulfillmentSnapshotError extends Error {
  constructor(
    readonly kind: "missing" | "malformed" | "unsupported_provider",
    message: string
  ) {
    super(message);
    this.name = "FulfillmentSnapshotError";
  }
}

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstDefined<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((value): value is T => value !== undefined);
}

function snapshotRecords(item: PersistedFulfillmentItem): JsonRecord[] {
  const provider = record(item.providerSnapshotJson);
  const file = record(item.printfulFileSnapshotJson);
  const placement = record(item.printfulPlacementSnapshotJson);
  return [
    provider,
    record(provider?.printfulFileSnapshot),
    record(provider?.printfulPlacementSnapshot),
    file,
    placement,
  ].filter((value): value is JsonRecord => Boolean(value));
}

function hasSnapshotData(item: PersistedFulfillmentItem): boolean {
  return snapshotRecords(item).some((value) => Object.keys(value).length > 0);
}

function valueFromRecords(records: JsonRecord[], key: string): unknown {
  return records.map((snapshot) => snapshot[key]).find((value) => value !== undefined);
}

function placementsFromRecords(records: JsonRecord[], item: PersistedFulfillmentItem): unknown {
  return firstDefined(
    valueFromRecords(records, "printfulPlacements"),
    Array.isArray(item.printfulPlacementSnapshotJson) ? item.printfulPlacementSnapshotJson : undefined,
    Array.isArray(record(item.providerSnapshotJson)?.printfulPlacementSnapshot)
      ? record(item.providerSnapshotJson)?.printfulPlacementSnapshot as unknown[]
      : undefined
  );
}

function validPrintfulPlacements(value: unknown): value is NonNullable<RevalidatedItem["printfulPlacements"]> {
  return Array.isArray(value) && value.length > 0 && value.every((placement) => {
    const row = record(placement);
    return Boolean(
      row &&
      nonEmptyString(row.placement) &&
      nonEmptyString(row.technique) &&
      (nonEmptyString(row.fileUrl) || positiveInteger(row.fileId))
    );
  });
}

function validProductOptions(value: unknown): value is NonNullable<RevalidatedItem["printfulProductOptions"]> {
  return Array.isArray(value) && value.every((option) => {
    const row = record(option);
    return Boolean(row && nonEmptyString(row.name) && ["string", "number", "boolean"].includes(typeof row.value));
  });
}

function immutableBase(item: PersistedFulfillmentItem, providerSnapshot: JsonRecord): Omit<RevalidatedItem, "fulfillmentProvider" | "providerVariantId" | "providerSku" | "providerSnapshot" | "printfulCatalogVariantId" | "printfulSyncVariantId" | "printfulStoreId" | "printfulPlacements" | "printfulProductOptions"> {
  if (!nonEmptyString(item.ahaProductId) || !nonEmptyString(item.ahaVariantId) || !nonEmptyString(item.sku) ||
    !nonEmptyString(item.titleSnapshot) || !positiveInteger(item.quantity) ||
    !Number.isSafeInteger(item.unitPrice) || !Number.isSafeInteger(item.lineTotal)) {
    throw new FulfillmentSnapshotError("malformed", "Persisted order item identity or quantity is malformed");
  }
  return {
    ahaProductId: item.ahaProductId,
    ahaVariantId: item.ahaVariantId,
    sku: item.sku,
    title: item.titleSnapshot,
    size: item.sizeSnapshot || "",
    color: item.colorSnapshot || undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    squareVariationId: item.squareVariationId || "",
  };
}

function rebuildPrintfulItem(item: PersistedFulfillmentItem): RevalidatedItem {
  const providerSnapshot = record(item.providerSnapshotJson) ?? {};
  const records = snapshotRecords(item);
  if (!hasSnapshotData(item)) {
    throw new FulfillmentSnapshotError("missing", "Paid legacy Printful item has no purchase-time fulfillment snapshot");
  }
  const storeId = positiveInteger(valueFromRecords(records, "printfulStoreId"));
  const syncVariantId = positiveInteger(valueFromRecords(records, "printfulSyncVariantId"));
  const catalogVariantId = positiveInteger(firstDefined(
    valueFromRecords(records, "printfulCatalogVariantId"),
    item.printfulCatalogVariantId ?? undefined
  ));
  const placements = placementsFromRecords(records, item);
  const productOptions = valueFromRecords(records, "printfulProductOptions");

  // The provider store is part of the immutable provider identity. Do not let
  // a changed PRINTFUL_STORE_ID redirect a historical paid order elsewhere.
  if (!storeId) {
    throw new FulfillmentSnapshotError("malformed", "Paid Printful item snapshot is missing its provider store id");
  }
  if (!syncVariantId && !(catalogVariantId && validPrintfulPlacements(placements))) {
    throw new FulfillmentSnapshotError("malformed", "Paid Printful item snapshot has no valid sync variant or catalog art placement");
  }
  if (productOptions !== undefined && !validProductOptions(productOptions)) {
    throw new FulfillmentSnapshotError("malformed", "Paid Printful item snapshot has invalid product options");
  }

  return {
    ...immutableBase(item, providerSnapshot),
    fulfillmentProvider: "printful",
    providerVariantId: item.providerVariantId || (catalogVariantId ? String(catalogVariantId) : undefined),
    providerSku: item.providerSku || item.sku,
    providerSnapshot,
    printfulCatalogVariantId: catalogVariantId,
    printfulSyncVariantId: syncVariantId,
    printfulStoreId: storeId,
    printfulPlacements: validPrintfulPlacements(placements) ? placements : undefined,
    printfulProductOptions: validProductOptions(productOptions) ? productOptions : undefined,
  };
}

function rebuildApliiqItem(item: PersistedFulfillmentItem): RevalidatedItem {
  const providerSnapshot = record(item.providerSnapshotJson);
  if (!providerSnapshot || Object.keys(providerSnapshot).length === 0) {
    throw new FulfillmentSnapshotError("missing", "Paid APLIIQ item has no purchase-time provider snapshot");
  }
  const providerSku = nonEmptyString(item.providerSku) ?? nonEmptyString(providerSnapshot.apliiqSku);
  const decoration = record(providerSnapshot.decoration);
  const privateLabel = record(providerSnapshot.privateLabel);
  if (!providerSku || !decoration || Object.keys(decoration).length === 0 ||
    !privateLabel || Object.keys(privateLabel).length === 0 ||
    providerSnapshot.mappingApproval !== "approved" || providerSnapshot.sampleApproval !== "approved") {
    throw new FulfillmentSnapshotError(
      "malformed",
      "Paid APLIIQ item snapshot is missing its APQ SKU or approved production evidence"
    );
  }
  return {
    ...immutableBase(item, providerSnapshot),
    fulfillmentProvider: "apliiq",
    providerVariantId: nonEmptyString(item.providerVariantId) ??
      nonEmptyString(providerSnapshot.apliiqVariantId) ?? providerSku,
    providerSku,
    providerSnapshot,
  };
}

/** Reconstruct the exact fulfillment source captured when payment was created. */
export function rebuildFulfillmentCartFromSnapshots(
  items: PersistedFulfillmentItem[], currency: string, subtotal: number
): RevalidatedCart {
  if (!items.length) throw new FulfillmentSnapshotError("missing", "Order has no fulfillment items");
  return {
    currency,
    subtotal,
    items: items.map((item) => {
      if (item.fulfillmentProvider === "printful") return rebuildPrintfulItem(item);
      if (item.fulfillmentProvider === "apliiq") return rebuildApliiqItem(item);
      throw new FulfillmentSnapshotError("unsupported_provider", "Paid order item has an unsupported fulfillment provider");
    }),
  };
}

/**
 * Only orders that predate provider snapshots may consult the live catalog,
 * and only to repair a legacy Printful order. Any partial/bad snapshot is a
 * manual-review case rather than permission to substitute current artwork.
 */
export function isLegacyPrintfulSnapshotRepairEligible(items: PersistedFulfillmentItem[]): boolean {
  return items.length > 0 && items.every((item) => item.fulfillmentProvider === "printful" && !hasSnapshotData(item));
}
