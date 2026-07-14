import { describe, expect, it } from "vitest";
import {
  aggregateFulfillmentStatus, groupItemsByPrintfulStore, isPrintfulConfirmationAllowed,
  shouldRetryPrintfulConfirmation,
} from "@/lib/commerce/fulfillment-state";

describe("multi-store fulfillment state", () => {
  it("groups order items by their owning Printful store", () => {
    const groups = groupItemsByPrintfulStore([
      { printfulStoreId: 14298228, printfulSyncVariantId: 10, quantity: 1 },
      { printfulStoreId: 697873, printfulSyncVariantId: 20, quantity: 2 },
      { printfulStoreId: 14298228, printfulSyncVariantId: 30, quantity: 1 },
    ], 14298228);

    expect(groups.get(14298228)).toHaveLength(2);
    expect(groups.get(697873)).toEqual([{ source: "sync_variant", sync_variant_id: 20, quantity: 2 }]);
  });

  it("reports partially shipped until every provider order ships", () => {
    expect(aggregateFulfillmentStatus(["shipped", "draft_created"])).toBe("partially_shipped");
    expect(aggregateFulfillmentStatus(["shipped", "shipped"])).toBe("shipped");
  });

  it("escalates any provider exception to manual review", () => {
    expect(aggregateFulfillmentStatus(["shipped", "manual_review"])).toBe("manual_review");
  });

  it("requires auto mode and both live-confirm flags", () => {
    expect(isPrintfulConfirmationAllowed({
      fulfillmentMode: "manual", allowConfirm: "true", liveMode: "true",
    })).toBe(false);
    expect(isPrintfulConfirmationAllowed({
      fulfillmentMode: "auto", allowConfirm: "true", liveMode: "true",
    })).toBe(true);
  });

  it("retries only an existing draft or failed confirmation, never a provider hold", () => {
    expect(shouldRetryPrintfulConfirmation({ confirmationAllowed: true, printfulOrderId: "123", status: "draft_created" })).toBe(true);
    expect(shouldRetryPrintfulConfirmation({ confirmationAllowed: true, printfulOrderId: "123", status: "confirmation_failed" })).toBe(true);
    expect(shouldRetryPrintfulConfirmation({ confirmationAllowed: true, printfulOrderId: "123", status: "manual_review" })).toBe(false);
    expect(shouldRetryPrintfulConfirmation({ confirmationAllowed: false, printfulOrderId: "123", status: "draft_created" })).toBe(false);
  });
});

describe("catalog-source fulfillment (blank + hosted art)", () => {
  const placements = [
    { placement: "front", technique: "dtg", fileUrl: "https://afterhoursagenda.com/printful-assets/Be_You.png", position: { width: 12, height: 13.87, top: 1.07, left: 0 } },
  ];

  it("builds a catalog order item when there is no sync variant but placements carry art", () => {
    const groups = groupItemsByPrintfulStore([
      { printfulStoreId: 14298228, printfulCatalogVariantId: 4874, printfulPlacements: placements, quantity: 2 },
    ], 14298228);
    expect(groups.get(14298228)).toEqual([{
      source: "catalog",
      catalog_variant_id: 4874,
      quantity: 2,
      placements: [{
        placement: "front",
        technique: "dtg",
        layers: [{ type: "file", url: "https://afterhoursagenda.com/printful-assets/Be_You.png", position: { width: 12, height: 13.87, top: 1.07, left: 0 } }],
      }],
    }]);
  });

  it("prefers the sync variant when both mappings exist", () => {
    const groups = groupItemsByPrintfulStore([
      { printfulStoreId: 14298228, printfulSyncVariantId: 10, printfulCatalogVariantId: 4874, printfulPlacements: placements, quantity: 1 },
    ], 14298228);
    expect(groups.get(14298228)).toEqual([{ source: "sync_variant", sync_variant_id: 10, quantity: 1 }]);
  });

  it("mixes sync and catalog items in one store order", () => {
    const groups = groupItemsByPrintfulStore([
      { printfulStoreId: 14298228, printfulSyncVariantId: 10, quantity: 1 },
      { printfulStoreId: 14298228, printfulCatalogVariantId: 4874, printfulPlacements: placements, quantity: 1 },
    ], 14298228);
    expect(groups.get(14298228)).toHaveLength(2);
    expect(groups.get(14298228)![0]).toMatchObject({ source: "sync_variant" });
    expect(groups.get(14298228)![1]).toMatchObject({ source: "catalog" });
  });

  it("skips catalog items whose placements are missing hosted art", () => {
    const groups = groupItemsByPrintfulStore([
      { printfulStoreId: 14298228, printfulCatalogVariantId: 4874, printfulPlacements: [{ placement: "front", technique: "dtg" }], quantity: 1 },
      { printfulStoreId: 14298228, printfulCatalogVariantId: 4874, printfulPlacements: [], quantity: 1 },
      { printfulStoreId: 14298228, printfulCatalogVariantId: 4874, quantity: 1 },
    ], 14298228);
    expect(groups.size).toBe(0);
  });

  it("omits position when the placement has none (Printful default fit)", () => {
    const groups = groupItemsByPrintfulStore([
      { printfulStoreId: 14298228, printfulCatalogVariantId: 4874, printfulPlacements: [{ placement: "front", technique: "dtg", fileUrl: "https://x/y.png" }], quantity: 1 },
    ], 14298228);
    const item = groups.get(14298228)![0] as Extract<import("@/lib/commerce/fulfillment-state").PrintfulOrderItem, { source: "catalog" }>;
    expect(item.placements[0].layers[0]).toEqual({ type: "file", url: "https://x/y.png" });
  });
});
