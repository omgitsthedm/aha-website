import { describe, expect, it } from "vitest";
import {
  FulfillmentSnapshotError,
  isLegacyPrintfulSnapshotRepairEligible,
  rebuildFulfillmentCartFromSnapshots,
  type PersistedFulfillmentItem,
} from "@/lib/commerce/fulfillment-snapshot";

const paidPrintfulItem = (overrides: Partial<PersistedFulfillmentItem> = {}): PersistedFulfillmentItem => ({
  ahaProductId: "aha-tee", ahaVariantId: "aha-tee-m", sku: "AHA-TEE-M", titleSnapshot: "Paid tee",
  sizeSnapshot: "M", colorSnapshot: "Black", quantity: 2, unitPrice: 4200, lineTotal: 8400,
  squareVariationId: "square-tee-m", printfulCatalogVariantId: 4865, fulfillmentProvider: "printful",
  providerVariantId: "4865", providerSku: "AHA-TEE-M",
  providerSnapshotJson: {
    printfulCatalogVariantId: 4865, printfulSyncVariantId: 4616188601, printfulStoreId: 14298228,
    printfulPlacements: [{ placement: "front", technique: "dtg", fileUrl: "https://cdn.example/paid-art.png" }],
  },
  printfulPlacementSnapshotJson: null, printfulFileSnapshotJson: null,
  ...overrides,
});

describe("paid-order fulfillment snapshots", () => {
  it("reconstructs the exact Printful provider and art captured at purchase time", () => {
    const cart = rebuildFulfillmentCartFromSnapshots([paidPrintfulItem()], "USD", 8400);
    expect(cart).toMatchObject({
      subtotal: 8400,
      items: [{ fulfillmentProvider: "printful", providerSku: "AHA-TEE-M", printfulStoreId: 14298228,
        printfulSyncVariantId: 4616188601,
        printfulPlacements: [{ fileUrl: "https://cdn.example/paid-art.png" }] }],
    });
  });

  it("supports the immutable legacy snapshot shape produced before provider-neutral fields", () => {
    const cart = rebuildFulfillmentCartFromSnapshots([paidPrintfulItem({
      providerSnapshotJson: { printfulCatalogVariantId: 4865, printfulFileSnapshot: {
        printfulSyncVariantId: 4616188601, printfulStoreId: 14298228,
      } },
    })], "USD", 8400);
    expect(cart.items[0]).toMatchObject({ printfulSyncVariantId: 4616188601, printfulStoreId: 14298228 });
  });

  it("accepts a persisted Printful placement that uses a provider file id", () => {
    const cart = rebuildFulfillmentCartFromSnapshots([paidPrintfulItem({
      providerSnapshotJson: {
        printfulCatalogVariantId: 4865,
        printfulStoreId: 14298228,
        printfulPlacements: [{ placement: "front", technique: "dtg", fileId: 98765 }],
      },
    })], "USD", 8400);
    expect(cart.items[0].printfulPlacements).toEqual([
      { placement: "front", technique: "dtg", fileId: 98765 },
    ]);
  });

  it("rejects a malformed snapshot rather than falling through to current catalog art", () => {
    expect(() => rebuildFulfillmentCartFromSnapshots([paidPrintfulItem({
      providerSnapshotJson: { printfulSyncVariantId: "not-a-number", printfulStoreId: 14298228 },
    })], "USD", 8400)).toThrow(FulfillmentSnapshotError);
    expect(isLegacyPrintfulSnapshotRepairEligible([paidPrintfulItem({
      providerSnapshotJson: { printfulSyncVariantId: "not-a-number", printfulStoreId: 14298228 },
    })])).toBe(false);
  });

  it("permits a live-catalog repair only for a truly snapshot-less legacy Printful item", () => {
    const legacy = paidPrintfulItem({
      providerSnapshotJson: null, printfulPlacementSnapshotJson: null, printfulFileSnapshotJson: null,
    });
    expect(() => rebuildFulfillmentCartFromSnapshots([legacy], "USD", 8400)).toThrow(/no purchase-time fulfillment snapshot/i);
    expect(isLegacyPrintfulSnapshotRepairEligible([legacy])).toBe(true);
  });

  it("requires an APLIIQ order to retain its APQ SKU and approved production evidence", () => {
    expect(() => rebuildFulfillmentCartFromSnapshots([paidPrintfulItem({
      fulfillmentProvider: "apliiq", providerVariantId: null, providerSku: null,
      providerSnapshotJson: { apliiqSku: "APQ-1998244S7A1" },
    })], "USD", 8400)).toThrow(/APLIIQ item snapshot is missing/i);

    const cart = rebuildFulfillmentCartFromSnapshots([paidPrintfulItem({
      fulfillmentProvider: "apliiq", providerVariantId: null, providerSku: "APQ-1998244S7A1",
      providerSnapshotJson: {
        apliiqSku: "APQ-1998244S7A1",
        decoration: { front: "art-v1" },
        privateLabel: { reference: "SB-2-155690" },
        mappingApproval: "approved",
        sampleApproval: "approved",
      },
    })], "USD", 8400);
    expect(cart.items[0]).toMatchObject({
      fulfillmentProvider: "apliiq",
      providerSku: "APQ-1998244S7A1",
      providerVariantId: "APQ-1998244S7A1",
    });
  });
});
