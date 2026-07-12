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
