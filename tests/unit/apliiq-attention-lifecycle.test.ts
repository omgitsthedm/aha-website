import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  selects: [] as Array<{ table: unknown; rows: Row[] }>,
  updates: [] as Array<{ table: unknown; values: Row }>,
  inserts: [] as Array<{ table: unknown; values: Row }>,
  returning: [] as Row[][],
  notifications: [] as Array<{ orderId: number; kind: string; payload: Row }>,
}));

// Same faithful-enough Drizzle stand-in the reconciliation suite uses: every
// builder is thenable, and a select asserts which table it was pointed at, so a
// mis-ordered fixture fails loudly instead of feeding the wrong rows into
// money-handling code.
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

  // Only a write that asked for `.returning()` gets rows back, exactly like
  // Drizzle. Keying the queue on that instead of on call order keeps these
  // fixtures from silently re-pointing at a different write when the number of
  // audit rows changes.
  const writeChain = (table: unknown): WriteChain => {
    let wantsReturning = false;
    const chain: WriteChain = {
      set(values) { mocks.updates.push({ table, values }); return chain; },
      values(values) { mocks.inserts.push({ table, values }); return chain; },
      where() { return chain; },
      onConflictDoNothing() { return chain; },
      returning() { wantsReturning = true; return chain; },
      then(resolve, reject) {
        return Promise.resolve(wantsReturning ? mocks.returning.shift() ?? [] : []).then(resolve, reject);
      },
    };
    return chain;
  };

  return {
    isDbConfigured: mocks.configured,
    db: () => ({
      select: () => selectChain(),
      update: (table: unknown) => writeChain(table),
      insert: (table: unknown) => writeChain(table),
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
import {
  acknowledgeApliiqAttention,
  applyApliiqFulfillmentEvent,
  isAttentionSupersededByProgress,
} from "@/lib/commerce/apliiq-webhook-events";
import { PARTIALLY_CANCELED_SHIPPED_STATUS, PARTIALLY_CANCELED_STATUS } from "@/lib/commerce/fulfillment-state";
import { assessApliiqOrderRecord } from "@/lib/commerce/reconciliation";
import type { ApliiqOrderRecord } from "@/lib/apliiq/types";

const queueSelect = (table: unknown, rows: Row[]) => mocks.selects.push({ table, rows });
const updatesTo = (table: unknown) => mocks.updates.filter((entry) => entry.table === table).map((entry) => entry.values);
const auditEntries = () => mocks.inserts.filter((entry) => entry.table === auditLog).map((entry) => entry.values);

const paidLine = (overrides: Row = {}): Row => ({
  id: 1, sku: "AHA-TEE-M", providerSku: "APQ-1998244S7A1", quantity: 2,
  unitPrice: 4500, lineTotal: 9000, cancelledAmountCents: 0, fulfillmentStatus: "confirmed",
  ...overrides,
});

const flaggedAt = new Date("2026-08-17T09:00:00.000Z");
const AWAITING = "APLIIQ is awaiting garment for provider order APQ-9001.";
const REFUND_OWED = "APLIIQ canceled 1 paid line item(s) worth 9000 cents; no customer refund has been issued.";
const QUANTITY_MISMATCH = "APLIIQ reports 1 unit(s) for provider order APQ-9001; the paid order submitted 2.";

/**
 * One flagged APLIIQ row plus one paid line, then a plain shipped callback.
 * This is the sequence the judge reproduced: APLIIQ's dashboard callback URL
 * goes live and a real webhook reaches the row before the next sweep does.
 */
async function shipFlaggedOrder(
  attentionReason: string,
  options: { rowStatus?: string; lines?: Row[]; aggregate?: string } = {}
): Promise<void> {
  const rowStatus = options.rowStatus ?? "confirmed";
  queueSelect(fulfillments, [{
    id: 10, orderId: 42, status: rowStatus, providerDataJson: null,
    attentionAt: flaggedAt, attentionReason,
  }]);
  queueSelect(orderItems, options.lines ?? [paidLine()]);
  queueSelect(shipments, []);
  mocks.returning.push([{ id: 88 }]);
  queueSelect(orders, [{ fulfillmentStatus: rowStatus }]);
  queueSelect(fulfillments, [{ status: options.aggregate ?? "shipped" }]);

  await applyApliiqFulfillmentEvent({
    payload: { fulfillment: { order_id: "APQ-9001" } },
    reference: { providerOrderId: "APQ-9001" },
    tracking: { status: "shipped", trackingNumbers: ["9400"], trackingUrls: [] },
  });
}

beforeEach(() => {
  mocks.configured.mockReturnValue(true);
  mocks.selects.length = 0;
  mocks.updates.length = 0;
  mocks.inserts.length = 0;
  mocks.returning.length = 0;
  mocks.notifications.length = 0;
});

describe("a shipped webhook retires the Awaiting hold it has answered", () => {
  it("clears the flag instead of latching it beyond the sweep's reach", async () => {
    await shipFlaggedOrder(AWAITING);

    // The latch: APLIIQ_SWEEP_STATUSES stops at `confirmed`, so a row that
    // reaches `shipped` is never re-polled — and the sweep was the only caller
    // permitted to retire a flag. The hold would have shown in the ops queue
    // for the life of the order.
    const [rowUpdate] = updatesTo(fulfillments);
    expect(rowUpdate).toMatchObject({
      status: "shipped", attentionAt: null, attentionReason: null, lastError: null,
    });

    const cleared = auditEntries().find((entry) => entry.action === "webhook:apliiq:attention");
    expect(cleared).toBeDefined();
    expect(cleared?.metadataJson).toMatchObject({
      attentionCleared: true,
      attentionSupersededBy: "shipped",
      supersededReason: AWAITING,
    });
  });

  it("keeps money owed and unattributable lines flagged for a human", async () => {
    await shipFlaggedOrder(REFUND_OWED, {
      rowStatus: PARTIALLY_CANCELED_STATUS,
      lines: [
        paidLine({ fulfillmentStatus: "canceled", cancelledAmountCents: 9000 }),
        paidLine({ id: 2, providerSku: "APQ-1998244S8A1" }),
      ],
      aggregate: PARTIALLY_CANCELED_SHIPPED_STATUS,
    });

    // Shipping the survivors answers a delay. It does not answer a refund.
    const [rowUpdate] = updatesTo(fulfillments);
    expect(rowUpdate).not.toHaveProperty("attentionAt");
    expect(rowUpdate).not.toHaveProperty("attentionReason");
    expect(auditEntries().some((entry) => entry.action === "webhook:apliiq:attention")).toBe(false);
    // ...and the row still resolves, so the shopper is not stuck either.
    expect(rowUpdate).toMatchObject({ status: PARTIALLY_CANCELED_SHIPPED_STATUS });
  });

  it("refuses a mixed flag where only one reason has been answered", async () => {
    await shipFlaggedOrder(`${AWAITING} ${QUANTITY_MISMATCH}`);

    const [rowUpdate] = updatesTo(fulfillments);
    expect(rowUpdate).toMatchObject({ status: "shipped" });
    expect(rowUpdate).not.toHaveProperty("attentionAt");
  });

  it("leaves a still-sweepable row to the sweep, which re-reads the whole record", async () => {
    queueSelect(fulfillments, [{
      id: 10, orderId: 42, status: "accepted_unprocessed", providerDataJson: null,
      attentionAt: flaggedAt, attentionReason: AWAITING,
    }]);
    queueSelect(orderItems, [paidLine()]);
    queueSelect(orders, [{ fulfillmentStatus: "accepted_unprocessed" }]);
    queueSelect(fulfillments, [{ status: "confirmed" }]);

    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: "APQ-9001" } },
      reference: { providerOrderId: "APQ-9001" },
      tracking: { status: "in_production", trackingNumbers: [], trackingUrls: [] },
    });

    // `confirmed` is inside APLIIQ_SWEEP_STATUSES, so the flag is not stranded:
    // the next sweep re-reads the provider record and retires it on evidence
    // rather than on a single callback that mentioned nothing about the hold.
    const [rowUpdate] = updatesTo(fulfillments);
    expect(rowUpdate).toMatchObject({ status: "confirmed" });
    expect(rowUpdate).not.toHaveProperty("attentionAt");
  });
});

describe("the supersede allow-list is wired to the wording the sweep actually writes", () => {
  // The allow-list matches reason TEXT written by ./reconciliation.ts. Copying
  // that wording into a local constant would let a reword there silently turn
  // the clear back off with every test still green, so these assertions read
  // the real producer instead.
  const record = (overrides: Partial<ApliiqOrderRecord> = {}): ApliiqOrderRecord => ({
    OrderId: "APQ-9001", Status: "In Production", TotalQty: 2, ...overrides,
  });
  const reasonFor = (input: { submittedQuantity: number; records: ApliiqOrderRecord[] }): string => {
    const assessment = assessApliiqOrderRecord({ providerOrderId: "APQ-9001", ...input });
    expect(assessment.attentionReason).toBeTruthy();
    return assessment.attentionReason as string;
  };

  it("recognises a real Awaiting hold and a record the provider could not produce", () => {
    expect(isAttentionSupersededByProgress(
      reasonFor({ submittedQuantity: 2, records: [record({ AwaitingGarment: true })] }), "shipped",
    )).toBe(true);
    expect(isAttentionSupersededByProgress(
      reasonFor({ submittedQuantity: 2, records: [record({ AwaitingArtwork: true, AwaitingSupplies: true })] }), "shipped",
    )).toBe(true);
    expect(isAttentionSupersededByProgress(
      reasonFor({ submittedQuantity: 2, records: [] }), "shipped",
    )).toBe(true);
  });

  it("refuses a real quantity mismatch, alone or alongside a hold", () => {
    // APLIIQ accepted the order and silently dropped a line. Shipping what is
    // left does not answer that, and never will.
    expect(isAttentionSupersededByProgress(
      reasonFor({ submittedQuantity: 3, records: [record({ TotalQty: 2 })] }), "shipped",
    )).toBe(false);
    expect(isAttentionSupersededByProgress(
      reasonFor({ submittedQuantity: 3, records: [record({ TotalQty: 2, AwaitingGarment: true })] }), "shipped",
    )).toBe(false);
  });
});

describe("acknowledgeApliiqAttention", () => {
  it("retires the flag a shipment is not allowed to touch, and audits it", async () => {
    queueSelect(fulfillments, [{ id: 10, status: PARTIALLY_CANCELED_SHIPPED_STATUS, attentionReason: REFUND_OWED }]);

    const result = await acknowledgeApliiqAttention(42);

    expect(result).toEqual({ orderId: 42, cleared: 1, reasons: [REFUND_OWED] });
    expect(updatesTo(fulfillments)).toEqual([{
      attentionAt: null, attentionReason: null, lastError: null, updatedAt: expect.any(Date),
    }]);
    // Status, order state and per-line money are untouched: attention_* is a
    // flag, not a state, and dismissing it is not a refund.
    expect(updatesTo(orders)).toEqual([]);
    expect(updatesTo(orderItems)).toEqual([]);

    const [audit] = auditEntries();
    expect(audit).toMatchObject({
      entityType: "fulfillment",
      entityId: "10",
      action: "ops:apliiq:attention-acknowledged",
      newStatus: PARTIALLY_CANCELED_SHIPPED_STATUS,
      source: "ops",
    });
    // The reason survives its own dismissal, so the record still says what was
    // acknowledged after the row stops saying it.
    expect(audit?.metadataJson).toMatchObject({ orderId: 42, acknowledgedReason: REFUND_OWED });
  });

  it("clears every flagged APLIIQ row on the order", async () => {
    queueSelect(fulfillments, [
      { id: 10, status: PARTIALLY_CANCELED_STATUS, attentionReason: REFUND_OWED },
      { id: 11, status: "confirmed", attentionReason: AWAITING },
    ]);

    const result = await acknowledgeApliiqAttention(42);

    expect(result.cleared).toBe(2);
    expect(result.reasons).toEqual([REFUND_OWED, AWAITING]);
    expect(updatesTo(fulfillments)).toHaveLength(2);
    expect(auditEntries()).toHaveLength(2);
  });

  it("is idempotent: a second acknowledge writes nothing and invents no audit", async () => {
    queueSelect(fulfillments, []);

    const result = await acknowledgeApliiqAttention(42);

    expect(result).toEqual({ orderId: 42, cleared: 0, reasons: [] });
    expect(mocks.updates).toEqual([]);
    expect(mocks.inserts).toEqual([]);
  });

  it("refuses an unusable order id or an unavailable store rather than reporting success", async () => {
    await expect(acknowledgeApliiqAttention(0)).rejects.toThrow("A valid order id is required.");
    await expect(acknowledgeApliiqAttention(1.5)).rejects.toThrow("A valid order id is required.");
    mocks.configured.mockReturnValue(false);
    await expect(acknowledgeApliiqAttention(42)).rejects.toThrow("Production order store is unavailable.");
    expect(mocks.updates).toEqual([]);
  });
});
