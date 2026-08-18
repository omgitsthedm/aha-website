import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  selects: [] as Array<{ table: unknown; rows: Row[] }>,
  updates: [] as Array<{ table: unknown; values: Row }>,
  inserts: [] as Array<{ table: unknown; values: Row }>,
  returning: [] as Row[][],
  notifications: [] as Array<{ orderId: number; kind: string; payload: Row }>,
}));

// A faithful-enough Drizzle stand-in: every builder is thenable, and a select
// asserts which table it was pointed at so a mis-ordered fixture fails loudly
// instead of silently feeding the wrong rows into money-handling code.
vi.mock("@/lib/db/client", () => {
  interface SelectChain {
    from(table: unknown): SelectChain;
    leftJoin(...args: unknown[]): SelectChain;
    where(...args: unknown[]): SelectChain;
    orderBy(...args: unknown[]): SelectChain;
    limit(...args: unknown[]): SelectChain;
    then<T>(resolve: (rows: Row[]) => T, reject?: (error: unknown) => T): Promise<T>;
  }
  interface WriteChain {
    set(values: Row): WriteChain;
    values(values: Row): WriteChain;
    where(...args: unknown[]): WriteChain;
    onConflictDoNothing(...args: unknown[]): WriteChain;
    returning(...args: unknown[]): WriteChain;
    then<T>(resolve: (rows: Row[]) => T, reject?: (error: unknown) => T): Promise<T>;
  }

  const selectChain = (): SelectChain => {
    let table: unknown = null;
    const chain: SelectChain = {
      from(next) { table = next; return chain; },
      leftJoin() { return chain; },
      where() { return chain; },
      orderBy() { return chain; },
      limit() { return chain; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          const entry = mocks.selects.shift();
          if (!entry) throw new Error("Unexpected select: no queued rows left");
          if (entry.table !== table) throw new Error("Select hit a different table than the fixture expected");
          return entry.rows;
        }).then(resolve, reject);
      },
    };
    return chain;
  };

  const writeChain = (table: unknown, kind: "update" | "insert"): WriteChain => {
    const chain: WriteChain = {
      set(values) { mocks.updates.push({ table, values }); return chain; },
      values(values) { mocks.inserts.push({ table, values }); return chain; },
      where() { return chain; },
      onConflictDoNothing() { return chain; },
      returning() { return chain; },
      then(resolve, reject) {
        return Promise.resolve(mocks.returning.shift() ?? []).then(resolve, reject);
      },
    };
    void kind;
    return chain;
  };

  return {
    isDbConfigured: mocks.configured,
    db: () => ({
      select: () => selectChain(),
      update: (table: unknown) => writeChain(table, "update"),
      insert: (table: unknown) => writeChain(table, "insert"),
    }),
  };
});

vi.mock("@/lib/commerce/notifications", () => ({
  enqueueOrderNotification: (orderId: number, kind: string, payload: Row = {}) => {
    mocks.notifications.push({ orderId, kind, payload });
    return Promise.resolve();
  },
  dispatchOrderNotifications: () => Promise.resolve({ configured: false, attempted: 0, sent: 0, failed: 0 }),
}));

import { auditLog, fulfillments, orderItems, orders, shipments } from "@/db/schema";
import { applyApliiqFulfillmentEvent } from "@/lib/commerce/apliiq-webhook-events";
import {
  ACCEPTED_UNPROCESSED_STATUS,
  PARTIALLY_CANCELED_SHIPPED_STATUS,
  PARTIALLY_CANCELED_STATUS,
} from "@/lib/commerce/fulfillment-state";
import {
  APLIIQ_SWEEP_STATUSES,
  assessApliiqOrderRecord,
  sweepStalledApliiqFulfillments,
} from "@/lib/commerce/reconciliation";
import type { ApliiqOrderRecord } from "@/lib/apliiq/types";
import type { NormalizedApliiqTracking } from "@/lib/apliiq/types";

const queueSelect = (table: unknown, rows: Row[]) => mocks.selects.push({ table, rows });

const paidLine = (overrides: Row = {}): Row => ({
  id: 1, sku: "AHA-TEE-M", providerSku: "APQ-1998244S7A1", quantity: 2,
  unitPrice: 4500, lineTotal: 9000, cancelledAmountCents: 0, fulfillmentStatus: "confirmed",
  ...overrides,
});

const tracking = (status: NormalizedApliiqTracking["status"]): NormalizedApliiqTracking => ({
  status, trackingNumbers: [], trackingUrls: [],
});

const updatesTo = (table: unknown) => mocks.updates.filter((entry) => entry.table === table).map((entry) => entry.values);

beforeEach(() => {
  mocks.configured.mockReturnValue(true);
  mocks.selects.length = 0;
  mocks.updates.length = 0;
  mocks.inserts.length = 0;
  mocks.returning.length = 0;
  mocks.notifications.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("APLIIQ cancellation writes per-line state and raises a refund flag", () => {
  it("cancels the named line, records the money owed, and emails somebody", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "confirmed", providerDataJson: null }]);
    queueSelect(orderItems, [paidLine(), paidLine({ id: 2, providerSku: "APQ-1998244S8A1" })]);
    queueSelect(orders, [{ fulfillmentStatus: "confirmed" }]);
    queueSelect(fulfillments, [{ status: "canceled" }]);

    const result = await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001", line_items: [{ sku: "APQ-1998244S7A1", quantity: 2 }] } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: tracking("cancelled"),
    });

    expect(result).toEqual({ outcome: "applied", orderId: 42, fulfillmentId: 10 });
    // Only the SKU APLIIQ named is cancelled — the other paid line is untouched.
    expect(updatesTo(orderItems)).toEqual([
      { fulfillmentStatus: "canceled", cancelledAmountCents: 9000, updatedAt: expect.any(Date) },
    ]);
    const attention = updatesTo(fulfillments).find((values) => values.attentionReason);
    expect(attention?.attentionReason).toContain("APLIIQ canceled 1 paid line item(s) worth 9000 cents");
    expect(attention?.attentionReason).toContain("no customer refund has been issued");
    expect(attention?.attentionAt).toBeInstanceOf(Date);
    // The old behaviour: DB updated to "Canceled", nobody told, nothing refunded.
    expect(mocks.notifications).toEqual([
      { orderId: 42, kind: "fulfillment_attention", payload: { reason: expect.stringContaining("APLIIQ canceled") } },
    ]);
    expect(mocks.inserts.filter((entry) => entry.table === auditLog).map((entry) => entry.values.action))
      .toContain("webhook:apliiq:line-items");
  });

  it("charges only the cancelled units when APLIIQ cancels part of a line", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "confirmed", providerDataJson: null }]);
    queueSelect(orderItems, [paidLine({ quantity: 3, lineTotal: 13500 })]);
    queueSelect(orders, [{ fulfillmentStatus: "confirmed" }]);
    queueSelect(fulfillments, [{ status: PARTIALLY_CANCELED_STATUS }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001", line_items: [{ sku: "APQ-1998244S7A1", quantity: 1 }] } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: tracking("cancelled"),
    });

    // 1 of 3 units cancelled: the money is recorded, but the line keeps the
    // status of the 2 units still in production. Marking it `canceled` would be
    // terminal per line and would freeze them.
    expect(updatesTo(orderItems)[0]).toMatchObject({ cancelledAmountCents: 4500, fulfillmentStatus: "confirmed" });
  });

  it("reports a subset cancel as partially canceled, never as a Canceled order", async () => {
    // The money-lossy case: APLIIQ cancels one SKU of two and the shopper used
    // to be told the whole order was Canceled while the rest was in production.
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "confirmed", providerDataJson: null }]);
    queueSelect(orderItems, [paidLine(), paidLine({ id: 2, providerSku: "APQ-1998244S8A1" })]);
    queueSelect(orders, [{ fulfillmentStatus: "confirmed" }]);
    queueSelect(fulfillments, [{ status: PARTIALLY_CANCELED_STATUS }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001", line_items: [{ sku: "APQ-1998244S7A1", quantity: 2 }] } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: tracking("cancelled"),
    });

    // There is one APLIIQ fulfillment row per order, so the row itself has to
    // carry the distinction — otherwise PARTIALLY_CANCELED_STATUS is
    // unreachable for an APLIIQ-only order.
    expect(updatesTo(fulfillments)[0]).toMatchObject({ status: PARTIALLY_CANCELED_STATUS });
    expect(updatesTo(fulfillments)[0]).not.toMatchObject({ status: "canceled" });
    expect(updatesTo(orderItems)).toEqual([
      { fulfillmentStatus: "canceled", cancelledAmountCents: 9000, updatedAt: expect.any(Date) },
    ]);
    expect(updatesTo(orders)).toEqual([{
      fulfillmentStatus: PARTIALLY_CANCELED_STATUS,
      customerStatus: "Partially canceled",
      updatedAt: expect.any(Date),
    }]);
  });

  it("collapses to Canceled only once every paid line is accounted for", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: PARTIALLY_CANCELED_STATUS, providerDataJson: null }]);
    // Line 1 was cancelled by the earlier callback; this one takes the last line.
    queueSelect(orderItems, [
      paidLine({ fulfillmentStatus: "canceled", cancelledAmountCents: 9000 }),
      paidLine({ id: 2, providerSku: "APQ-1998244S8A1" }),
    ]);
    queueSelect(orders, [{ fulfillmentStatus: PARTIALLY_CANCELED_STATUS }]);
    queueSelect(fulfillments, [{ status: "canceled" }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001", line_items: [{ sku: "APQ-1998244S8A1", quantity: 2 }] } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: tracking("cancelled"),
    });

    // Coverage is cumulative, so partially_canceled is not a dead end.
    expect(updatesTo(fulfillments)[0]).toMatchObject({ status: "canceled" });
    expect(updatesTo(orderItems)).toEqual([
      { fulfillmentStatus: "canceled", cancelledAmountCents: 9000, updatedAt: expect.any(Date) },
    ]);
    expect(updatesTo(orders)).toEqual([{
      fulfillmentStatus: "canceled", customerStatus: "Canceled", updatedAt: expect.any(Date),
    }]);
  });

  it("ships the surviving lines of a partially cancelled order without manual review", async () => {
    const flaggedAt = new Date("2026-08-17T12:00:00.000Z");
    queueSelect(fulfillments, [{
      id: 10, orderId: 42, status: PARTIALLY_CANCELED_STATUS, providerDataJson: null,
      attentionAt: flaggedAt,
      attentionReason: "APLIIQ canceled 1 paid line item(s) worth 9000 cents; no customer refund has been issued.",
    }]);
    queueSelect(orderItems, [
      paidLine({ fulfillmentStatus: "canceled", cancelledAmountCents: 9000 }),
      paidLine({ id: 2, providerSku: "APQ-1998244S8A1" }),
    ]);
    queueSelect(shipments, []);
    // The stub's returning queue is consumed by every awaited write in order:
    // the row status update, its audit row, the surviving line's update, then
    // the shipment insert.
    mocks.returning.push([], [], [], [{ id: 77 }]);
    queueSelect(orders, [{ fulfillmentStatus: PARTIALLY_CANCELED_STATUS }]);
    queueSelect(fulfillments, [{ status: PARTIALLY_CANCELED_SHIPPED_STATUS }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001" } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: { status: "shipped", trackingNumbers: ["9400"], trackingUrls: [] },
    });

    // This is the transition that used to dead-end: canceled + shipped resolved
    // to absorbing manual_review, so the order could never move again. Holding
    // it at partially_canceled instead was the second half of the same latch —
    // the survivors shipped, the shopper was emailed about it, and the status
    // they could read never moved again. Every surviving line is terminal, so
    // the row is too.
    expect(updatesTo(fulfillments)[0]).toMatchObject({ status: PARTIALLY_CANCELED_SHIPPED_STATUS });
    expect(updatesTo(orders)).toEqual([{
      fulfillmentStatus: PARTIALLY_CANCELED_SHIPPED_STATUS,
      customerStatus: "Shipped (part of your order was canceled)",
      updatedAt: expect.any(Date),
    }]);
    expect(updatesTo(orderItems)).toEqual([
      { fulfillmentStatus: "shipped", cancelledAmountCents: 0, updatedAt: expect.any(Date) },
    ]);
    // The cancelled line stays cancelled and the refund flag survives untouched:
    // money owed is not retired by the lines that did ship.
    expect(updatesTo(fulfillments).some((values) => "attentionAt" in values)).toBe(false);
    expect(mocks.notifications.map((entry) => entry.kind)).toEqual(["order_shipped"]);
    expect(mocks.inserts.some((entry) => entry.table === shipments)).toBe(true);
  });

  it("keeps the cancelled portion visible when another provider batch shipped", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "confirmed", providerDataJson: null }]);
    queueSelect(orderItems, [paidLine()]);
    queueSelect(orders, [{ fulfillmentStatus: "partially_shipped" }]);
    // Two provider rows: the APLIIQ batch cancelled, a Printful batch shipped.
    queueSelect(fulfillments, [{ status: "canceled" }, { status: "shipped" }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001" } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: tracking("cancelled"),
    });

    // The cancelled batch is still named in the copy — it is not summarised
    // away by the batch that shipped — but the order is finished and says so.
    expect(updatesTo(orders)).toEqual([{
      fulfillmentStatus: PARTIALLY_CANCELED_SHIPPED_STATUS,
      customerStatus: "Shipped (part of your order was canceled)",
      updatedAt: expect.any(Date),
    }]);
  });

  it("flags a callback line item that no paid line can account for", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "draft_created", providerDataJson: null }]);
    queueSelect(orderItems, [paidLine()]);
    queueSelect(orders, [{ fulfillmentStatus: "draft_created" }]);
    queueSelect(fulfillments, [{ status: ACCEPTED_UNPROCESSED_STATUS }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001", line_items: [{ sku: "APQ-SOMEONE-ELSES" }] } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: tracking("pending"),
    });

    expect(updatesTo(orderItems)).toEqual([]);
    // APLIIQ "New" must land on accepted_unprocessed, not confirmed.
    expect(updatesTo(fulfillments)[0]).toMatchObject({ status: ACCEPTED_UNPROCESSED_STATUS });
    expect(updatesTo(fulfillments).find((values) => values.attentionReason)?.attentionReason)
      .toBe("APLIIQ referenced line items that do not match this paid order: APQ-SOMEONE-ELSES.");
    expect(updatesTo(orders)[0]).toMatchObject({ customerStatus: "Received by our print shop" });
  });
});

describe("assessApliiqOrderRecord", () => {
  const record = (overrides: Partial<ApliiqOrderRecord> = {}): ApliiqOrderRecord => ({
    OrderId: "APQ-9001", Status: "In Production", TotalQty: 2, ...overrides,
  });

  it("passes a clean record straight through", () => {
    const assessment = assessApliiqOrderRecord({
      providerOrderId: "APQ-9001", submittedQuantity: 2, records: [record()],
    });
    expect(assessment.attentionReason).toBeUndefined();
    expect(assessment.tracking.status).toBe("in_production");
    expect(assessment.providerTotalQty).toBe(2);
  });

  it("catches a silently dropped line item through TotalQty", () => {
    const assessment = assessApliiqOrderRecord({
      providerOrderId: "APQ-9001", submittedQuantity: 3, records: [record({ TotalQty: 2 })],
    });
    expect(assessment.attentionReason)
      .toBe("APLIIQ reports 2 unit(s) for provider order APQ-9001; the paid order submitted 3.");
    // A quantity mismatch outranks a healthy-looking status.
    expect(assessment.tracking.status).toBe("attention");
  });

  it("flags an Awaiting hold without overriding the reported production status", () => {
    const assessment = assessApliiqOrderRecord({
      providerOrderId: "APQ-9001",
      submittedQuantity: 2,
      records: [record({ AwaitingGarment: true, AwaitingSupplies: true, AwaitingArtwork: false })],
    });
    expect(assessment.attentionReason).toBe("APLIIQ is awaiting garment, supplies for provider order APQ-9001.");
    // Waiting on blank stock is ordinary production, not an exception. Calling
    // it "attention" drove the row to manual_review, which is absorbing and
    // outside APLIIQ_SWEEP_STATUSES — a one-day garment wait froze the order
    // on "Action needed" permanently.
    expect(assessment.tracking.status).toBe("in_production");
    expect(assessment.tracking.status).not.toBe("attention");
  });

  it("still overrides the status when the record contradicts the paid order", () => {
    const assessment = assessApliiqOrderRecord({
      providerOrderId: "APQ-9001",
      submittedQuantity: 3,
      records: [record({ TotalQty: 2, AwaitingGarment: true })],
    });
    // A dropped line is a contradiction, not a delay: it outranks the status
    // even when an ordinary Awaiting flag is set alongside it.
    expect(assessment.tracking.status).toBe("attention");
    expect(assessment.attentionReason).toContain("APLIIQ is awaiting garment");
    expect(assessment.attentionReason).toContain("the paid order submitted 3");
  });

  it("picks the record that matches the provider order id", () => {
    const assessment = assessApliiqOrderRecord({
      providerOrderId: "APQ-9001",
      submittedQuantity: 2,
      records: [record({ OrderId: "APQ-1", Status: "Shipped" }), record({ Status: "Cancelled" })],
    });
    expect(assessment.tracking.status).toBe("cancelled");
  });

  it("refuses to attribute an unlabelled multi-record response", () => {
    const assessment = assessApliiqOrderRecord({
      providerOrderId: "APQ-9001",
      submittedQuantity: 2,
      records: [{ Status: "Shipped" }, { Status: "New" }],
    });
    expect(assessment.tracking.status).toBe("attention");
    expect(assessment.attentionReason).toContain("no attributable order record");
  });

  it("accepts a single unlabelled record, which the endpoint documents", () => {
    const assessment = assessApliiqOrderRecord({
      providerOrderId: "APQ-9001", submittedQuantity: 2, records: [{ Status: "New" }],
    });
    expect(assessment.tracking.status).toBe("pending");
    expect(assessment.attentionReason).toBeUndefined();
  });
});

describe("sweepStalledApliiqFulfillments", () => {
  it("only re-polls states that reconcilePaidOrders will never revisit", () => {
    // draft_created is the one the old candidate query excluded, which is how a
    // submitted order sat on "Preparing your order" forever.
    expect(APLIIQ_SWEEP_STATUSES).toEqual(["draft_created", ACCEPTED_UNPROCESSED_STATUS, "confirmed"]);
  });

  it("pulls the provider status for a stalled order and records the unit count", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "draft_created", providerOrderId: "APQ-9001" }]);
    queueSelect(orderItems, [{ quantity: 2 }]);
    // applyApliiqFulfillmentEvent's own reads
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "draft_created", providerDataJson: null }]);
    queueSelect(orderItems, [paidLine({ fulfillmentStatus: "not_started" })]);
    queueSelect(orders, [{ fulfillmentStatus: "draft_created" }]);
    queueSelect(fulfillments, [{ status: "confirmed" }]);

    const result = await sweepStalledApliiqFulfillments({
      getOrder: () => Promise.resolve([{ OrderId: "APQ-9001", Status: "In Production", TotalQty: 2 }]),
    });

    expect(result).toEqual({ examined: 1, advanced: 1, flagged: 0, failed: 0, skipped: null });
    expect(updatesTo(fulfillments)).toContainEqual(expect.objectContaining({ status: "confirmed" }));
    expect(updatesTo(orderItems)).toEqual([
      { fulfillmentStatus: "confirmed", cancelledAmountCents: 0, updatedAt: expect.any(Date) },
    ]);
    expect(updatesTo(orders)[0]).toMatchObject({ fulfillmentStatus: "confirmed", customerStatus: "In production" });
    expect(updatesTo(fulfillments).at(-1)).toEqual({ providerTotalQty: 2, updatedAt: expect.any(Date) });
  });

  it("raises an Awaiting flag on a row it can still come back to", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "confirmed", providerOrderId: "APQ-9001" }]);
    queueSelect(orderItems, [{ quantity: 2 }]);
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "confirmed", providerDataJson: null }]);
    queueSelect(orderItems, [paidLine()]);
    queueSelect(orders, [{ fulfillmentStatus: "confirmed" }]);
    queueSelect(fulfillments, [{ status: "confirmed" }]);

    const result = await sweepStalledApliiqFulfillments({
      getOrder: () => Promise.resolve([
        { OrderId: "APQ-9001", Status: "In Production", TotalQty: 2, AwaitingArtwork: true },
      ]),
    });

    expect(result).toMatchObject({ examined: 1, advanced: 0, flagged: 1, failed: 0 });
    const flagUpdate = updatesTo(fulfillments)[0];
    expect(flagUpdate).toMatchObject({
      attentionAt: expect.any(Date),
      attentionReason: "APLIIQ is awaiting artwork for provider order APQ-9001.",
    });
    // The flag never rewrites fulfillment state, and the state it leaves behind
    // is one the sweep will look at again.
    expect(flagUpdate.status).toBeUndefined();
    expect(APLIIQ_SWEEP_STATUSES).toContain("confirmed");
    expect(updatesTo(orders)).toEqual([]);
    expect(mocks.notifications[0]).toMatchObject({ orderId: 42, kind: "fulfillment_attention" });
  });

  it("retires the flag on the next poll once the Awaiting hold has lifted", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "confirmed", providerOrderId: "APQ-9001" }]);
    queueSelect(orderItems, [{ quantity: 2 }]);
    queueSelect(fulfillments, [{
      id: 10, orderId: 42, status: "confirmed", providerDataJson: null,
      attentionAt: new Date("2026-08-17T12:00:00.000Z"),
      attentionReason: "APLIIQ is awaiting artwork for provider order APQ-9001.",
    }]);
    queueSelect(orderItems, [paidLine()]);
    queueSelect(orders, [{ fulfillmentStatus: "confirmed" }]);
    queueSelect(fulfillments, [{ status: "confirmed" }]);

    const result = await sweepStalledApliiqFulfillments({
      getOrder: () => Promise.resolve([{ OrderId: "APQ-9001", Status: "In Production", TotalQty: 2 }]),
    });

    expect(result).toMatchObject({ examined: 1, advanced: 0, flagged: 0, failed: 0 });
    expect(updatesTo(fulfillments)[0]).toMatchObject({ attentionAt: null, attentionReason: null });
    expect(mocks.notifications).toEqual([]);
  });

  it("never lets an inbound webhook clear somebody else's attention flag", async () => {
    queueSelect(fulfillments, [{
      id: 10, orderId: 42, status: "confirmed", providerDataJson: null,
      attentionAt: new Date("2026-08-17T12:00:00.000Z"),
      attentionReason: "APLIIQ canceled 1 paid line item(s) worth 9000 cents; no customer refund has been issued.",
    }]);
    queueSelect(orderItems, [paidLine()]);
    queueSelect(orders, [{ fulfillmentStatus: "confirmed" }]);
    queueSelect(fulfillments, [{ status: "confirmed" }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001" } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: tracking("in_production"),
    });

    expect(updatesTo(fulfillments)).toEqual([]);
  });

  it("leaves the row exactly as it is when the provider call fails", async () => {
    queueSelect(fulfillments, [{ id: 10, orderId: 42, status: "draft_created", providerOrderId: "APQ-9001" }]);

    const result = await sweepStalledApliiqFulfillments({
      getOrder: () => Promise.reject(new Error("ETIMEDOUT")),
    });

    expect(result).toMatchObject({ examined: 1, advanced: 0, flagged: 0, failed: 1 });
    expect(mocks.updates).toEqual([]);
    expect(mocks.notifications).toEqual([]);
  });

  it("does nothing at all when the order store is unavailable", async () => {
    mocks.configured.mockReturnValue(false);
    const result = await sweepStalledApliiqFulfillments({ getOrder: () => Promise.resolve([]) });
    expect(result).toEqual({ examined: 0, advanced: 0, flagged: 0, failed: 0, skipped: "not_configured" });
    expect(mocks.updates).toEqual([]);
  });

  it("skips instead of throwing when APLIIQ credentials are absent", async () => {
    const apiKey = process.env.APLIIQ_API_KEY;
    const sharedSecret = process.env.APLIIQ_SHARED_SECRET;
    delete process.env.APLIIQ_API_KEY;
    delete process.env.APLIIQ_SHARED_SECRET;
    try {
      await expect(sweepStalledApliiqFulfillments()).resolves.toMatchObject({ skipped: "no_credentials" });
    } finally {
      if (apiKey === undefined) delete process.env.APLIIQ_API_KEY; else process.env.APLIIQ_API_KEY = apiKey;
      if (sharedSecret === undefined) delete process.env.APLIIQ_SHARED_SECRET; else process.env.APLIIQ_SHARED_SECRET = sharedSecret;
    }
  });
});
