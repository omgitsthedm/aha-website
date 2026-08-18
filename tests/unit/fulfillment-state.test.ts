import { describe, expect, it } from "vitest";
import {
  ACCEPTED_UNPROCESSED_STATUS, PARTIALLY_CANCELED_SHIPPED_STATUS, PARTIALLY_CANCELED_STATUS,
  aggregateFulfillmentStatus, buildStoreOrderRequest, customerStatusFor,
  groupFulfillmentsByOrder, groupItemsByPrintfulStore,
  groupSourceItemsByPrintfulStore, isPrintfulConfirmationAllowed,
  resolvePrintfulAssetUrl, shouldRetryPrintfulConfirmation,
} from "@/lib/commerce/fulfillment-state";

const ARCHIVED_ART_BASE = "https://raw.githubusercontent.com/omgitsthedm/aha-website/d255aa403b6bf4a978cb5f9af969a72cdc5c2488/public/printful-assets/";

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
        layers: [{ type: "file", url: `${ARCHIVED_ART_BASE}Be_You.png`, position: { width: 12, height: 13.87, top: 1.07, left: 0 } }],
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

  it("moves only retired custom-site art URLs to the immutable provider archive", () => {
    expect(resolvePrintfulAssetUrl("https://afterhoursagenda.com/printful-assets/Black_Sheep_CLEAN_Print_Front.png"))
      .toBe(`${ARCHIVED_ART_BASE}Black_Sheep_CLEAN_Print_Front.png`);
    expect(resolvePrintfulAssetUrl("https://cdn.example.com/printful-assets/art.png"))
      .toBe("https://cdn.example.com/printful-assets/art.png");
    expect(resolvePrintfulAssetUrl("https://afterhoursagenda.com/printful-assets/%2E%2E%2Fsecret"))
      .toBe("https://afterhoursagenda.com/printful-assets/%2E%2E%2Fsecret");
  });
});

describe("buildStoreOrderRequest (v1/v2 API routing)", () => {
  const recipient = { name: "T", address1: "1 St", city: "NYC", country_code: "US", zip: "10001" };
  const catalogItem = {
    printfulStoreId: 14298228, printfulCatalogVariantId: 20357, quantity: 1,
    printfulPlacements: [{
      placement: "front_large", technique: "dtg",
      fileUrl: "https://afterhoursagenda.com/printful-assets/Black_Sheep_CLEAN_Print_Front.png",
      position: { width: 15, height: 11.7679, top: 1, left: 0, areaWidth: 15, areaHeight: 18 },
    }],
  };
  const syncItem = { printfulStoreId: 14298228, printfulSyncVariantId: 4616188601, quantity: 2 };

  it("routes catalog-only batches to v2 with the placements shape (area fields stripped)", () => {
    const req = buildStoreOrderRequest([catalogItem], recipient)!;
    expect(req.apiVersion).toBe("v2");
    const items = req.body.order_items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    const placement = (items[0].placements as Array<{ layers: Array<{ position?: Record<string, number> }> }>)[0];
    expect(placement.layers[0].position).toEqual({ width: 15, height: 11.7679, top: 1, left: 0 });
    expect((placement.layers[0] as { url: string }).url).toBe(`${ARCHIVED_ART_BASE}Black_Sheep_CLEAN_Print_Front.png`);
  });

  it("routes any batch containing a sync item to v1, converting catalog items to files", () => {
    const req = buildStoreOrderRequest([syncItem, catalogItem], recipient)!;
    expect(req.apiVersion).toBe("v1");
    const items = req.body.items as Array<Record<string, unknown>>;
    expect(items[0]).toEqual({ sync_variant_id: 4616188601, quantity: 2 });
    const files = items[1].files as Array<Record<string, unknown>>;
    expect(items[1].variant_id).toBe(20357);
    expect(files[0].type).toBe("front_large");
    expect(files[0].url).toBe(`${ARCHIVED_ART_BASE}Black_Sheep_CLEAN_Print_Front.png`);
    // inches -> pixels at 150dpi, area carried through
    expect(files[0].position).toEqual({ area_width: 2250, area_height: 2700, width: 2250, height: 1765, top: 150, left: 0 });
  });

  it("carries product options: v2 product_options / v1 item options", () => {
    const tote = {
      printfulStoreId: 14298228, printfulCatalogVariantId: 10457, quantity: 1,
      printfulProductOptions: [{ name: "stitch_color", value: "black" }],
      printfulPlacements: [{ placement: "default", technique: "cut-sew", fileUrl: "https://x/tile.png" }],
    };
    const v2 = buildStoreOrderRequest([tote], recipient)!;
    expect((v2.body.order_items as Array<Record<string, unknown>>)[0].product_options)
      .toEqual([{ name: "stitch_color", value: "black" }]);
    const v1 = buildStoreOrderRequest([syncItem, tote], recipient)!;
    expect((v1.body.items as Array<Record<string, unknown>>)[1].options)
      .toEqual([{ id: "stitch_color", value: "black" }]);
  });

  it("omits v1 position when the stored position has no area dimensions", () => {
    const noArea = {
      printfulStoreId: 14298228, printfulCatalogVariantId: 1, quantity: 1,
      printfulPlacements: [{ placement: "front", technique: "dtg", fileUrl: "https://x/a.png", position: { width: 12, height: 9, top: 1, left: 0 } }],
    };
    const req = buildStoreOrderRequest([syncItem, noArea], recipient)!;
    const files = (req.body.items as Array<Record<string, unknown>>)[1].files as Array<Record<string, unknown>>;
    expect(files[0].position).toBeUndefined();
  });

  it("returns null when nothing in the batch is fulfillable", () => {
    expect(buildStoreOrderRequest([{ printfulStoreId: 14298228, quantity: 1 }], recipient)).toBeNull();
  });

  it("groups source items per store keeping only fulfillable ones", () => {
    const groups = groupSourceItemsByPrintfulStore([
      syncItem, catalogItem,
      { printfulStoreId: 14298228, printfulCatalogVariantId: 2, quantity: 1 }, // no placements
    ], 14298228);
    expect(groups.get(14298228)).toHaveLength(2);
  });
});

describe("cancellation and accepted-but-unprocessed aggregation", () => {
  it("never lets a shipped line erase a cancelled one", () => {
    // The money-lossy case: this used to return partially_shipped, so the
    // cancelled portion disappeared with no refund and no flag. It still must
    // never do that — but it must not stall on "Partially canceled" either
    // once every batch that survived the cancellation is out the door.
    expect(aggregateFulfillmentStatus(["canceled", "shipped"])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(aggregateFulfillmentStatus(["shipped", "canceled"])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(aggregateFulfillmentStatus(["canceled", "delivered"])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    for (const statuses of [["canceled", "shipped"], ["canceled", "delivered"]]) {
      expect(aggregateFulfillmentStatus(statuses)).not.toBe("shipped");
      expect(aggregateFulfillmentStatus(statuses)).not.toBe("partially_shipped");
      expect(aggregateFulfillmentStatus(statuses)).not.toBe("delivered");
    }
    // Still in production: nothing is resolved, so nothing claims to be.
    expect(aggregateFulfillmentStatus(["canceled", "confirmed"])).toBe(PARTIALLY_CANCELED_STATUS);
  });

  it("resolves a partial cancellation once every surviving batch has shipped", () => {
    // The permanent latch: the survivors shipped, the shopper got an
    // order_shipped email, and the only status they could read still said
    // "Partially canceled" — with no later event able to move it.
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_SHIPPED_STATUS])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_SHIPPED_STATUS, "shipped"])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_SHIPPED_STATUS, "delivered"])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_SHIPPED_STATUS, "canceled"])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    // One batch still working holds the whole order back to unresolved.
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_SHIPPED_STATUS, "confirmed"])).toBe(PARTIALLY_CANCELED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_SHIPPED_STATUS, PARTIALLY_CANCELED_STATUS])).toBe(PARTIALLY_CANCELED_STATUS);
    // An exception still outranks everything.
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_SHIPPED_STATUS, "manual_review"])).toBe("manual_review");
  });

  it("still collapses a wholly cancelled order and still escalates an exception", () => {
    expect(aggregateFulfillmentStatus(["canceled", "canceled"])).toBe("canceled");
    expect(aggregateFulfillmentStatus(["canceled", "manual_review"])).toBe("manual_review");
  });

  it("honours a provider row that is itself partially cancelled", () => {
    // There is one APLIIQ fulfillment row per order, so a subset cancel lives
    // on the row. Without this the lone row fell through every branch and
    // aggregated to "queued" — shopper copy "Payment confirmed".
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_STATUS])).toBe(PARTIALLY_CANCELED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_STATUS, "shipped"])).toBe(PARTIALLY_CANCELED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_STATUS, "confirmed"])).toBe(PARTIALLY_CANCELED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_STATUS, "canceled"])).toBe(PARTIALLY_CANCELED_STATUS);
    expect(aggregateFulfillmentStatus([PARTIALLY_CANCELED_STATUS, "manual_review"])).toBe("manual_review");
    expect(customerStatusFor(aggregateFulfillmentStatus([PARTIALLY_CANCELED_STATUS]))).toBe("Partially canceled");
  });

  it("holds the order at the least-progressed provider batch", () => {
    expect(aggregateFulfillmentStatus([ACCEPTED_UNPROCESSED_STATUS])).toBe(ACCEPTED_UNPROCESSED_STATUS);
    expect(aggregateFulfillmentStatus([ACCEPTED_UNPROCESSED_STATUS, "confirmed"])).toBe(ACCEPTED_UNPROCESSED_STATUS);
    expect(aggregateFulfillmentStatus(["draft_created", ACCEPTED_UNPROCESSED_STATUS])).toBe("draft_created");
    expect(aggregateFulfillmentStatus([ACCEPTED_UNPROCESSED_STATUS, "shipped"])).toBe("partially_shipped");
  });

  it("keeps every pre-existing aggregate answer", () => {
    expect(aggregateFulfillmentStatus([])).toBe("not_started");
    expect(aggregateFulfillmentStatus(["confirmed", "confirmed"])).toBe("confirmed");
    expect(aggregateFulfillmentStatus(["draft_created", "confirmed"])).toBe("draft_created");
    expect(aggregateFulfillmentStatus(["delivered", "delivered"])).toBe("delivered");
    expect(aggregateFulfillmentStatus(["draft_creating", "queued"])).toBe("draft_creating");
    expect(aggregateFulfillmentStatus(["queued"])).toBe("queued");
  });

  it("gives every new state honest shopper copy instead of a silent fallback", () => {
    expect(customerStatusFor(ACCEPTED_UNPROCESSED_STATUS)).toBe("Received by our print shop");
    expect(customerStatusFor(PARTIALLY_CANCELED_STATUS)).toBe("Partially canceled");
    // Both halves of the truth. "Partially canceled" alone contradicted the
    // order_shipped email the shopper had already been sent; "Shipped" alone
    // would hide money still owed to them.
    expect(customerStatusFor(PARTIALLY_CANCELED_SHIPPED_STATUS))
      .toBe("Shipped (part of your order was canceled)");
    expect(customerStatusFor(PARTIALLY_CANCELED_SHIPPED_STATUS)).not.toBe("Payment confirmed");
    expect(customerStatusFor("confirmed")).toBe("In production");
    expect(customerStatusFor("draft_created")).toBe("Preparing your order");
    expect(customerStatusFor("manual_review")).toBe("Action needed");
    expect(customerStatusFor("not_started")).toBe("Payment confirmed");
  });

  it("indexes provider rows by order and drops unlinked ones", () => {
    const grouped = groupFulfillmentsByOrder([
      { orderId: 7, id: 1 }, { orderId: 7, id: 2 }, { orderId: 9, id: 3 }, { orderId: null, id: 4 },
    ]);
    expect(grouped.get(7)?.map((row) => row.id)).toEqual([1, 2]);
    expect(grouped.get(9)?.map((row) => row.id)).toEqual([3]);
    expect(grouped.size).toBe(2);
  });
});
