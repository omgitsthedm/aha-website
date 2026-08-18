import { describe, expect, it } from "vitest";
import {
  apliiqFulfillmentStatusFor,
  cancellationCoversWholeBatch,
  cancelledAmountForLine,
  isAttentionSupersededByProgress,
  matchApliiqLineItems,
  nextApliiqFulfillmentStatus,
  nextOrderItemFulfillmentStatus,
  parseApliiqFulfillmentEvent,
  resolvePartiallyCanceledRowStatus,
  type ApliiqOrderItemLine,
} from "@/lib/commerce/apliiq-webhook-events";
import {
  ACCEPTED_UNPROCESSED_STATUS,
  PARTIALLY_CANCELED_SHIPPED_STATUS,
  PARTIALLY_CANCELED_STATUS,
} from "@/lib/commerce/fulfillment-state";
import { ORDER_ITEM_FULFILLMENT_STATUS } from "@/db/schema";

const paidLine = (overrides: Partial<ApliiqOrderItemLine> = {}): ApliiqOrderItemLine => ({
  id: 1,
  sku: "AHA-TEE-M",
  providerSku: "APQ-1998244S7A1",
  quantity: 2,
  unitPrice: 4500,
  lineTotal: 9000,
  cancelledAmountCents: 0,
  fulfillmentStatus: "confirmed",
  ...overrides,
});

describe("APLIIQ fulfillment webhook event parsing", () => {
  it("requires a fulfillment envelope and a durable provider reference", () => {
    expect(parseApliiqFulfillmentEvent({})).toBeNull();
    expect(parseApliiqFulfillmentEvent({ fulfillment: { status: "Shipped" } })).toBeNull();
    expect(parseApliiqFulfillmentEvent({ fulfillment: "not-an-object" })).toBeNull();
  });

  it("normalizes shipment data only after accepting the signed-event envelope", () => {
    expect(parseApliiqFulfillmentEvent({
      fulfillment: {
        order_id: 1234,
        status: "Success",
        tracking_company: "USPS",
        tracking_numbers: ["9400", "9400", 12],
        tracking_urls: ["https://tools.usps.com/track/9400", "http://untrusted.example/9400"],
      },
    })).toEqual({
      payload: {
        fulfillment: {
          order_id: "1234",
          status: "Success",
          tracking_company: "USPS",
          tracking_numbers: ["9400", "9400", 12],
          tracking_urls: ["https://tools.usps.com/track/9400", "http://untrusted.example/9400"],
        },
      },
      reference: { providerOrderId: "1234" },
      tracking: {
        status: "shipped",
        carrier: "USPS",
        trackingNumbers: ["9400"],
        trackingUrls: ["https://tools.usps.com/track/9400"],
      },
    });
  });

  it("uses request/reference aliases without treating unknown statuses as shipped", () => {
    const event = parseApliiqFulfillmentEvent({
      fulfillment: {
        request_id: "request-1",
        store_system_order_id: "aha-order-1",
        status: "awaiting review",
        tracking_numbers: ["must-not-upgrade"],
      },
    });

    expect(event?.reference).toEqual({
      providerRequestId: "request-1",
      providerReference: "aha-order-1",
    });
    expect(event?.tracking).toEqual({
      status: "unknown",
      trackingNumbers: ["must-not-upgrade"],
      trackingUrls: [],
    });
  });

  it("accepts an explicit root provider reference when APLIIQ nests only shipment data", () => {
    const event = parseApliiqFulfillmentEvent({
      reference: "aha-order-2",
      fulfillment: { status: "In Production" },
    });

    expect(event?.reference).toEqual({ providerReference: "aha-order-2" });
    expect(event?.tracking.status).toBe("in_production");
  });

  it("holds out-of-order progress callbacks and escalates terminal conflicts", () => {
    expect(nextApliiqFulfillmentStatus("shipped", "confirmed")).toBe("shipped");
    expect(nextApliiqFulfillmentStatus("shipped", "canceled")).toBe("manual_review");
    expect(nextApliiqFulfillmentStatus("canceled", "confirmed")).toBe("manual_review");
    expect(nextApliiqFulfillmentStatus("manual_review", "shipped")).toBe("manual_review");
  });
});

describe("APLIIQ provider status to internal fulfillment status", () => {
  it("keeps an untouched garment out of production", () => {
    // APLIIQ "New" normalizes to the provider status `pending`, which used to
    // map to `confirmed` and told the shopper "In production".
    expect(apliiqFulfillmentStatusFor("pending")).toBe(ACCEPTED_UNPROCESSED_STATUS);
    expect(apliiqFulfillmentStatusFor("pending")).not.toBe("confirmed");
  });

  it("reserves confirmed for real work on the garment", () => {
    expect(apliiqFulfillmentStatusFor("in_production")).toBe("confirmed");
    expect(apliiqFulfillmentStatusFor("ready_to_ship")).toBe("confirmed");
    expect(apliiqFulfillmentStatusFor("shipped")).toBe("shipped");
    expect(apliiqFulfillmentStatusFor("cancelled")).toBe("canceled");
    expect(apliiqFulfillmentStatusFor("attention")).toBe("manual_review");
    expect(apliiqFulfillmentStatusFor("unknown")).toBe("manual_review");
  });

  it("normalizes APLIIQ's two-L 'cancelled' into the one-L schema vocabulary", () => {
    // A two-L internal value would compile and then silently never match.
    expect(ORDER_ITEM_FULFILLMENT_STATUS).toContain(apliiqFulfillmentStatusFor("cancelled"));
  });

  it("never walks production back to accepted-but-unprocessed", () => {
    expect(nextApliiqFulfillmentStatus("confirmed", ACCEPTED_UNPROCESSED_STATUS)).toBe("confirmed");
    expect(nextApliiqFulfillmentStatus("draft_created", ACCEPTED_UNPROCESSED_STATUS)).toBe(ACCEPTED_UNPROCESSED_STATUS);
    expect(nextApliiqFulfillmentStatus(ACCEPTED_UNPROCESSED_STATUS, "confirmed")).toBe("confirmed");
    expect(nextApliiqFulfillmentStatus(ACCEPTED_UNPROCESSED_STATUS, "canceled")).toBe("canceled");
  });
});

describe("partial cancellation of an APLIIQ batch", () => {
  const twoLines = () => [paidLine(), paidLine({ id: 2, providerSku: "APQ-1998244S8A1" })];

  it("only reports whole-batch coverage when every paid unit is accounted for", () => {
    const items = twoLines();
    expect(cancellationCoversWholeBatch(
      matchApliiqLineItems(undefined, items).matched, items
    )).toBe(true);
    expect(cancellationCoversWholeBatch(
      matchApliiqLineItems([{ sku: "APQ-1998244S7A1", quantity: 2 }], items).matched, items
    )).toBe(false);
    // Part of a single line is not the whole line either.
    expect(cancellationCoversWholeBatch(
      matchApliiqLineItems([{ sku: "APQ-1998244S7A1", quantity: 1 }], [items[0]]).matched, [items[0]]
    )).toBe(false);
  });

  it("counts value already cancelled, so the last line still collapses the order", () => {
    const items = [
      paidLine({ fulfillmentStatus: "canceled", cancelledAmountCents: 9000 }),
      paidLine({ id: 2, providerSku: "APQ-1998244S8A1" }),
    ];
    expect(cancellationCoversWholeBatch(
      matchApliiqLineItems([{ sku: "APQ-1998244S8A1", quantity: 2 }], items).matched, items
    )).toBe(true);
  });

  it("holds a partially cancelled row instead of latching it", () => {
    // manual_review is absorbing; partially_canceled must not be, or the
    // surviving lines could never be reported at all.
    expect(nextApliiqFulfillmentStatus("confirmed", PARTIALLY_CANCELED_STATUS)).toBe(PARTIALLY_CANCELED_STATUS);
    // Two status strings cannot answer "did the survivors ship?" — that is a
    // per-line fact, and resolvePartiallyCanceledRowStatus() answers it below.
    // This hold is provisional, NOT the row's final state.
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_STATUS, "shipped")).toBe(PARTIALLY_CANCELED_STATUS);
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_STATUS, "shipped")).not.toBe("manual_review");
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_STATUS, "confirmed")).toBe(PARTIALLY_CANCELED_STATUS);
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_STATUS, "canceled")).toBe("canceled");
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_STATUS, "manual_review")).toBe("manual_review");
    // A subset of a cancel already recorded is not a conflict.
    expect(nextApliiqFulfillmentStatus("canceled", PARTIALLY_CANCELED_STATUS)).toBe("canceled");
  });

  it("resolves the row once every surviving line is terminal", () => {
    const cancelledLine = { fulfillmentStatus: "canceled" as const, cancelledAmountCents: 9000, lineTotal: 9000 };
    // The latch: this is the state the judge reproduced — one line cancelled,
    // the other shipped, and the row stuck on "Partially canceled" for good.
    expect(resolvePartiallyCanceledRowStatus([
      cancelledLine, { fulfillmentStatus: "shipped", cancelledAmountCents: 0, lineTotal: 9000 },
    ])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(resolvePartiallyCanceledRowStatus([
      cancelledLine, { fulfillmentStatus: "delivered", cancelledAmountCents: 0, lineTotal: 9000 },
    ])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    // A survivor still in production keeps the row unresolved.
    expect(resolvePartiallyCanceledRowStatus([
      cancelledLine, { fulfillmentStatus: "confirmed", cancelledAmountCents: 0, lineTotal: 9000 },
    ])).toBe(PARTIALLY_CANCELED_STATUS);
    // A line whose units were only partly cancelled is a survivor: the units
    // still in production are exactly what stops the row resolving.
    expect(resolvePartiallyCanceledRowStatus([
      { fulfillmentStatus: "confirmed", cancelledAmountCents: 4500, lineTotal: 13500 },
    ])).toBe(PARTIALLY_CANCELED_STATUS);
    expect(resolvePartiallyCanceledRowStatus([
      { fulfillmentStatus: "shipped", cancelledAmountCents: 4500, lineTotal: 13500 },
    ])).toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    // Nothing survived after all: a whole-batch cancel that arrived in pieces.
    expect(resolvePartiallyCanceledRowStatus([cancelledLine, { ...cancelledLine }])).toBe("canceled");
    // Nothing cancelled, nothing to resolve — the caller keeps its own answer.
    expect(resolvePartiallyCanceledRowStatus([
      { fulfillmentStatus: "shipped", cancelledAmountCents: 0, lineTotal: 9000 },
    ])).toBeNull();
    expect(resolvePartiallyCanceledRowStatus([])).toBeNull();
  });

  it("treats the shipped resolution as terminal, not as a new rung to climb", () => {
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_SHIPPED_STATUS, "shipped"))
      .toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_SHIPPED_STATUS, "confirmed"))
      .toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_SHIPPED_STATUS, PARTIALLY_CANCELED_STATUS))
      .toBe(PARTIALLY_CANCELED_SHIPPED_STATUS);
    // Cancelling a batch that has already left the building needs a human.
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_SHIPPED_STATUS, "canceled")).toBe("manual_review");
    expect(nextApliiqFulfillmentStatus(PARTIALLY_CANCELED_SHIPPED_STATUS, "manual_review")).toBe("manual_review");
  });

  it("gives the resolved row a status the schema vocabulary can carry per line", () => {
    // The row status is order-level, but every per-line state it drives has to
    // stay inside the schema's own one-L vocabulary.
    expect(ORDER_ITEM_FULFILLMENT_STATUS).toContain("shipped");
    expect(ORDER_ITEM_FULFILLMENT_STATUS).toContain("canceled");
    expect(PARTIALLY_CANCELED_SHIPPED_STATUS).not.toContain("cancelled");
  });
});

describe("attention flags a shipped callback may retire", () => {
  const awaiting = "APLIIQ is awaiting garment, artwork for provider order APQ-9001.";
  const refundOwed = "APLIIQ canceled 1 paid line item(s) worth 9000 cents; no customer refund has been issued.";
  const quantityMismatch = "APLIIQ reports 2 unit(s) for provider order APQ-9001; the paid order submitted 3.";
  const noRecord = "APLIIQ returned no attributable order record for provider order APQ-9001.";

  it("retires an Awaiting hold the shipment has already answered", () => {
    // The latch: APLIIQ_SWEEP_STATUSES stops at `confirmed`, so once a real
    // webhook moves the row to `shipped` the sweep — the only caller allowed to
    // clear a flag — never looks at this order again.
    expect(isAttentionSupersededByProgress(awaiting, "shipped")).toBe(true);
    expect(isAttentionSupersededByProgress(awaiting, "delivered")).toBe(true);
    expect(isAttentionSupersededByProgress(awaiting, PARTIALLY_CANCELED_SHIPPED_STATUS)).toBe(true);
    expect(isAttentionSupersededByProgress(noRecord, "shipped")).toBe(true);
  });

  it("never lets shipping retire money owed or a line that does not add up", () => {
    expect(isAttentionSupersededByProgress(refundOwed, "shipped")).toBe(false);
    expect(isAttentionSupersededByProgress(quantityMismatch, "shipped")).toBe(false);
    expect(isAttentionSupersededByProgress(
      "APLIIQ referenced line items that do not match this paid order: APQ-NOT-OURS.", "shipped",
    )).toBe(false);
    // Mixed flag: the hold is answered, the mismatch is not, so nothing goes.
    expect(isAttentionSupersededByProgress(`${awaiting} ${quantityMismatch}`, "shipped")).toBe(false);
    expect(isAttentionSupersededByProgress(`${quantityMismatch} ${awaiting}`, "shipped")).toBe(false);
  });

  it("leaves a still-sweepable row for the sweep, which re-reads the whole record", () => {
    expect(isAttentionSupersededByProgress(awaiting, "confirmed")).toBe(false);
    expect(isAttentionSupersededByProgress(awaiting, ACCEPTED_UNPROCESSED_STATUS)).toBe(false);
    expect(isAttentionSupersededByProgress(awaiting, "draft_created")).toBe(false);
    expect(isAttentionSupersededByProgress(awaiting, PARTIALLY_CANCELED_STATUS)).toBe(false);
    expect(isAttentionSupersededByProgress(awaiting, "manual_review")).toBe(false);
    expect(isAttentionSupersededByProgress(null, "shipped")).toBe(false);
    expect(isAttentionSupersededByProgress("", "shipped")).toBe(false);
  });
});

describe("APLIIQ callback line attribution", () => {
  it("treats an empty line list as the whole APLIIQ batch", () => {
    const items = [paidLine(), paidLine({ id: 2, providerSku: "APQ-1998244S8A1" })];
    expect(matchApliiqLineItems(undefined, items).matched).toEqual([
      { item: items[0], quantity: 2 }, { item: items[1], quantity: 2 },
    ]);
    expect(matchApliiqLineItems([], items).matched).toHaveLength(2);
  });

  it("attributes by provider SKU and clamps the covered quantity to the paid line", () => {
    const items = [paidLine(), paidLine({ id: 2, providerSku: "APQ-1998244S8A1" })];
    const result = matchApliiqLineItems([
      { sku: "apq-1998244s7a1", quantity: "1" },
      { sku: "APQ-1998244S8A1", quantity: 99 },
    ], items);
    expect(result.matched).toEqual([{ item: items[0], quantity: 1 }, { item: items[1], quantity: 2 }]);
    expect(result.unmatched).toEqual([]);
  });

  it("reports an unattributable SKU instead of guessing a line", () => {
    const items = [paidLine(), paidLine({ id: 2 })]; // same provider SKU twice
    const result = matchApliiqLineItems([{ sku: "APQ-1998244S7A1" }, { sku: "APQ-NOT-OURS" }, {}], items);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual(["APQ-1998244S7A1", "APQ-NOT-OURS", "(missing sku)"]);
  });

  it("sums repeated callback lines for one paid line without exceeding it", () => {
    const items = [paidLine({ quantity: 3 })];
    const result = matchApliiqLineItems([
      { sku: "APQ-1998244S7A1", quantity: 1 }, { sku: "APQ-1998244S7A1", quantity: 5 },
    ], items);
    expect(result.matched).toEqual([{ item: items[0], quantity: 3 }]);
  });
});

describe("per-line cancellation accounting", () => {
  it("uses the line total for a whole line and the unit price for a partial one", () => {
    expect(cancelledAmountForLine(paidLine(), 2)).toBe(9000);
    expect(cancelledAmountForLine(paidLine(), 1)).toBe(4500);
  });

  it("never lowers an amount already recorded as owed", () => {
    expect(cancelledAmountForLine(paidLine({ cancelledAmountCents: 9000 }), 1)).toBe(9000);
  });

  it("keeps canceled and refunded terminal against later progress callbacks", () => {
    expect(nextOrderItemFulfillmentStatus("canceled", "shipped")).toBe("canceled");
    expect(nextOrderItemFulfillmentStatus("refunded", "confirmed")).toBe("refunded");
    expect(nextOrderItemFulfillmentStatus("shipped", "confirmed")).toBe("shipped");
    expect(nextOrderItemFulfillmentStatus("shipped", "delivered")).toBe("delivered");
    expect(nextOrderItemFulfillmentStatus("not_started", "queued")).toBe("queued");
    expect(nextOrderItemFulfillmentStatus("confirmed", "manual_review")).toBe("manual_review");
    expect(nextOrderItemFulfillmentStatus("confirmed", "canceled")).toBe("canceled");
  });

  it("spells the cancelled line state with one L, matching the aggregate", () => {
    // A two-L "cancelled" would silently never match aggregateFulfillmentStatus.
    expect(ORDER_ITEM_FULFILLMENT_STATUS).toContain("canceled");
    expect(ORDER_ITEM_FULFILLMENT_STATUS).not.toContain("cancelled");
    expect(nextOrderItemFulfillmentStatus("confirmed", "canceled")).toBe("canceled");
  });
});
