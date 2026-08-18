// HIGH 5: ops-only force resubmit for an APLIIQ order the provider never received.
//
// The whole safety argument is "prove absence first", so most of these tests are
// about refusing. An unproven absence (401, 5xx, transport error) must never be
// mistaken for a proven one, and nothing may be released before the reads run.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApliiqHttpError } from "@/lib/apliiq/client";
import { auditLog, fulfillments } from "@/db/schema";
import type { ApliiqClient, ApliiqOrderRecord } from "@/lib/apliiq/types";

interface DbCall {
  op: "select" | "insert" | "update";
  table?: unknown;
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
  where?: unknown;
}

interface QueryChain {
  from(table: unknown): QueryChain;
  where(...args: unknown[]): QueryChain;
  limit(...args: unknown[]): QueryChain;
  orderBy(...args: unknown[]): QueryChain;
  values(value: Record<string, unknown>): QueryChain;
  set(value: Record<string, unknown>): QueryChain;
  onConflictDoNothing(...args: unknown[]): QueryChain;
  returning(...args: unknown[]): QueryChain;
  then(onFulfilled: (rows: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown): Promise<unknown>;
}

const harness = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  const insertQueue: unknown[][] = [];
  const updateQueue: unknown[][] = [];
  const calls: DbCall[] = [];

  function chain(queue: unknown[][], entry: DbCall): QueryChain {
    const link: QueryChain = {
      from(table) { entry.table = table; return link; },
      where(...args) { entry.where = args[0]; return link; },
      limit() { return link; },
      orderBy() { return link; },
      values(value) { entry.values = value; return link; },
      set(value) { entry.set = value; return link; },
      onConflictDoNothing() { return link; },
      returning() { return link; },
      then(onFulfilled, onRejected) { return Promise.resolve(queue.shift() ?? []).then(onFulfilled, onRejected); },
    };
    return link;
  }

  return {
    selectQueue, insertQueue, updateQueue, calls,
    configured: vi.fn(() => true),
    db: () => ({
      select() { const entry: DbCall = { op: "select" }; calls.push(entry); return chain(selectQueue, entry); },
      insert(table: unknown) { const entry: DbCall = { op: "insert", table }; calls.push(entry); return chain(insertQueue, entry); },
      update(table: unknown) { const entry: DbCall = { op: "update", table }; calls.push(entry); return chain(updateQueue, entry); },
    }),
  };
});

const providerMocks = vi.hoisted(() => ({
  getOrder: vi.fn(),
  listOrders: vi.fn(),
  blockReason: vi.fn<() => string | null>(() => null),
  liveClient: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ db: harness.db, isDbConfigured: harness.configured }));

vi.mock("@/lib/commerce/notifications", () => ({
  enqueueOrderNotification: vi.fn(async () => undefined),
  dispatchOrderNotifications: vi.fn(async () => undefined),
}));

vi.mock("@/lib/apliiq/orders", () => ({
  getApliiqOrder: providerMocks.getOrder,
  listApliiqOrders: providerMocks.listOrders,
}));

vi.mock("@/lib/fulfillment/apliiq-adapter", () => ({
  submitApliiqFulfillment: vi.fn(),
  getApliiqSubmissionBlockReason: providerMocks.blockReason,
  isApliiqSubmissionAllowed: vi.fn(() => true),
  createLiveApliiqClient: providerMocks.liveClient,
}));

import { forceResubmitApliiqFulfillment } from "@/lib/commerce/fulfillment";

const ORDER_ID = 77;
const EXTERNAL = "AHA-10077";
const DETERMINISTIC_ID = `aha-apliiq-${ORDER_ID}`;
const client = { request: vi.fn(), requestWithMetadata: vi.fn() } as unknown as ApliiqClient;

function paidOrder(overrides: Record<string, unknown> = {}) {
  return { externalOrderNumber: EXTERNAL, paymentStatus: "paid", squarePaymentId: "sq-pay-1", ...overrides };
}

function submittedClaim(overrides: Record<string, unknown> = {}) {
  return { id: 9, providerRequestId: DETERMINISTIC_ID, providerOrderId: null, providerDataJson: null, status: "manual_review", ...overrides };
}

/** A gate hold: no create POST was ever issued, so there is no absence to prove. */
function heldClaim(overrides: Record<string, unknown> = {}) {
  return submittedClaim({ providerRequestId: null, ...overrides });
}

/** The one-shot authorization this function writes for the ordinary path. */
function writtenAuthorization(call: DbCall | undefined): Record<string, unknown> | undefined {
  const providerData = call?.set?.providerDataJson as Record<string, unknown> | undefined;
  return providerData?.apliiqHoldRelease as Record<string, unknown> | undefined;
}

function fulfillmentUpdates(): DbCall[] {
  return harness.calls.filter((call) => call.op === "update" && call.table === fulfillments);
}

function auditActions(): string[] {
  return harness.calls
    .filter((call) => call.op === "insert" && call.table === auditLog)
    .map((call) => String(call.values?.action ?? ""));
}

/** The default posture: every read succeeds and finds nothing. */
function queueProvenAbsence(): void {
  providerMocks.getOrder.mockRejectedValue(new ApliiqHttpError(404));
  providerMocks.listOrders.mockResolvedValue([]);
}

describe("APLIIQ force resubmit — refusals", () => {
  beforeEach(() => {
    harness.configured.mockReturnValue(true);
    providerMocks.blockReason.mockReturnValue(null);
    queueProvenAbsence();
  });

  afterEach(() => {
    harness.selectQueue.length = 0;
    harness.insertQueue.length = 0;
    harness.updateQueue.length = 0;
    harness.calls.length = 0;
    vi.clearAllMocks();
  });

  it("refuses, and reads nothing from the provider, while submission is gated", async () => {
    providerMocks.blockReason.mockReturnValue("APLIIQ order submission requires APLIIQ_LIVE_MODE=true.");
    harness.selectQueue.push([paidOrder()]);

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toEqual({ outcome: "blocked", reason: "APLIIQ order submission requires APLIIQ_LIVE_MODE=true." });
    expect(providerMocks.getOrder).not.toHaveBeenCalled();
    expect(providerMocks.listOrders).not.toHaveBeenCalled();
  });

  it("refuses an order that is not paid", async () => {
    harness.selectQueue.push([paidOrder({ paymentStatus: "created" })]);
    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);
    expect(result).toMatchObject({ outcome: "blocked" });
    expect(fulfillmentUpdates()).toHaveLength(0);
  });

  it("refuses an order with no persisted Square payment id", async () => {
    harness.selectQueue.push([paidOrder({ squarePaymentId: null })]);
    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);
    expect(result).toMatchObject({ outcome: "blocked", reason: expect.stringContaining("Square payment id") });
  });

  it("refuses a missing order", async () => {
    harness.selectQueue.push([]);
    expect(await forceResubmitApliiqFulfillment(ORDER_ID, client)).toEqual({ outcome: "blocked", reason: "Order not found." });
  });

  it("refuses when no APLIIQ claim row exists", async () => {
    harness.selectQueue.push([paidOrder()], []);
    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);
    expect(result).toMatchObject({ outcome: "blocked", reason: expect.stringContaining("No APLIIQ claim") });
    expect(providerMocks.listOrders).not.toHaveBeenCalled();
  });

  it("refuses a claim that already carries a provider order id", async () => {
    harness.selectQueue.push([paidOrder()], [submittedClaim({ providerOrderId: "apliiq-4242" })]);
    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);
    expect(result).toEqual({
      outcome: "blocked",
      reason: "APLIIQ already holds order apliiq-4242; nothing was resubmitted.",
      providerOrderId: "apliiq-4242",
    });
  });

  it("will not authorize a gate hold while submission is still gated", async () => {
    providerMocks.blockReason.mockReturnValue("APLIIQ order submission requires APLIIQ_LIVE_MODE=true.");
    harness.selectQueue.push([paidOrder()], [heldClaim()]);

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "blocked" });
    expect(fulfillmentUpdates()).toHaveLength(0);
  });

  it("refuses when the held claim changes while the release is being authorized", async () => {
    harness.selectQueue.push([paidOrder()], [heldClaim()]);
    harness.updateQueue.push([]); // the conditional authorization UPDATE matched no row

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "blocked", reason: expect.stringContaining("changed while the hold release") });
    expect(auditActions()).not.toContain("fulfillment:apliiq_hold_release_authorized");
  });

  it("refuses a request identity it cannot re-derive", async () => {
    harness.selectQueue.push([paidOrder()], [submittedClaim({ providerRequestId: "hand-edited-42" })]);
    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);
    expect(result).toMatchObject({ outcome: "blocked", reason: expect.stringContaining("hand-edited-42") });
    expect(providerMocks.getOrder).not.toHaveBeenCalled();
  });

  it("treats an auth failure on the id lookup as unproven, never as absence", async () => {
    providerMocks.getOrder.mockRejectedValue(new ApliiqHttpError(401));
    harness.selectQueue.push([paidOrder()], [submittedClaim()]);

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "blocked", reason: expect.stringContaining("absence could not be proven") });
    expect(fulfillmentUpdates()).toHaveLength(0);
    expect(auditActions()).toContain("fulfillment:apliiq_resubmit_refused");
  });

  it("treats a failing listing as unproven, never as absence", async () => {
    providerMocks.listOrders.mockRejectedValue(new Error("socket hang up"));
    harness.selectQueue.push([paidOrder()], [submittedClaim()]);

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "blocked", reason: expect.stringContaining("socket hang up") });
    expect(fulfillmentUpdates()).toHaveLength(0);
  });

  it("refuses and adopts the provider order id when the listing shows APLIIQ does hold it", async () => {
    const record: ApliiqOrderRecord = { OrderId: 550123, StoreSystemOrderId: DETERMINISTIC_ID, Status: "New" };
    providerMocks.listOrders.mockResolvedValue([record]);
    harness.selectQueue.push([paidOrder()], [submittedClaim()]);

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "blocked", providerOrderId: "550123" });
    expect(fulfillmentUpdates()[0].set).toMatchObject({ providerOrderId: "550123" });
    expect(fulfillmentUpdates()[0].set?.providerRequestId).toBeUndefined();
    expect(auditActions()).toContain("fulfillment:apliiq_resubmit_refused_present");
  });

  it("matches the provider record on the AHA order number too", async () => {
    providerMocks.listOrders.mockResolvedValue([{ OrderId: "A-1", StoreOrderId: EXTERNAL.toLowerCase() }]);
    harness.selectQueue.push([paidOrder()], [submittedClaim()]);

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "blocked", providerOrderId: "A-1" });
  });

  it("refuses when the claim changed underneath the absence check", async () => {
    harness.selectQueue.push([paidOrder()], [submittedClaim()]);
    harness.updateQueue.push([]); // the conditional release UPDATE matched no row

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "blocked", reason: expect.stringContaining("changed during the absence check") });
    expect(auditActions()).not.toContain("fulfillment:apliiq_resubmit_authorized");
  });
});

// The other half of the same endpoint: a row that was HELD, never POSTed. It is
// the only writer of a hold-release authorization, which is what keeps the
// 15-minute cron from releasing the backlog on its own when the gates open.
describe("APLIIQ force resubmit — gate-hold release", () => {
  beforeEach(() => {
    harness.configured.mockReturnValue(true);
    providerMocks.blockReason.mockReturnValue(null);
    queueProvenAbsence();
    harness.updateQueue.push([{ id: 9 }]);
  });

  afterEach(() => {
    harness.selectQueue.length = 0;
    harness.insertQueue.length = 0;
    harness.updateQueue.length = 0;
    harness.calls.length = 0;
    vi.clearAllMocks();
  });

  it("authorizes one held order without reading the provider at all", async () => {
    harness.selectQueue.push([paidOrder()], [heldClaim()]);

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({
      outcome: "released",
      release: "hold_authorized",
      providerRequestId: DETERMINISTIC_ID,
    });
    // Nothing to prove absent: the row never reached the create call.
    expect(providerMocks.getOrder).not.toHaveBeenCalled();
    expect(providerMocks.listOrders).not.toHaveBeenCalled();
    if (result.outcome !== "released") throw new Error("expected a released outcome");
    expect(result.evidence.lookups).toEqual([]);
    expect(result.evidence.basis).toContain("no APLIIQ create request was ever issued");
  });

  it("writes the one-shot authorization and leaves the request id NULL", async () => {
    harness.selectQueue.push([paidOrder()], [heldClaim()]);

    await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(fulfillmentUpdates()).toHaveLength(1);
    const authorization = writtenAuthorization(fulfillmentUpdates()[0]);
    expect(authorization).toMatchObject({ authorizedBy: "ops:apliiq-force-resubmit", basis: "never_submitted", releasedFrom: "manual_review" });
    expect(Number.isNaN(Date.parse(String(authorization?.authorizedAt)))).toBe(false);
    // The claim itself is untouched: the ordinary path still does the claiming.
    expect(fulfillmentUpdates()[0].set?.providerRequestId).toBeUndefined();
    expect(fulfillmentUpdates()[0].set?.providerOrderId).toBeUndefined();
    expect(auditActions()).toContain("fulfillment:apliiq_hold_release_authorized");
  });

  it("authorizes against the exact unclaimed row and nothing else", async () => {
    harness.selectQueue.push([paidOrder()], [heldClaim()]);

    await forceResubmitApliiqFulfillment(ORDER_ID, client);

    const columns: string[] = [];
    const walk = (node: unknown, depth = 0): void => {
      if (depth > 16 || node === null || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (typeof record.name === "string" && typeof record.columnType === "string") { columns.push(record.name); return; }
      if (Array.isArray(record.queryChunks)) record.queryChunks.forEach((chunk) => walk(chunk, depth + 1));
    };
    walk(fulfillmentUpdates()[0].where);
    expect(columns).toEqual(["id", "provider_request_id", "provider_order_id"]);
  });

  it("keeps existing provider data alongside the authorization", async () => {
    harness.selectQueue.push([paidOrder()], [heldClaim({ providerDataJson: { latestWebhook: { status: "unknown" } } })]);

    await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(fulfillmentUpdates()[0].set?.providerDataJson).toMatchObject({
      latestWebhook: { status: "unknown" },
      apliiqHoldRelease: { basis: "never_submitted" },
    });
  });

  it("authorizes exactly one order per call", async () => {
    harness.selectQueue.push([paidOrder()], [heldClaim()]);

    await forceResubmitApliiqFulfillment(ORDER_ID, client);

    // One row, one authorization: there is no bulk entry point anywhere.
    expect(fulfillmentUpdates()).toHaveLength(1);
    expect(auditActions().filter((action) => action === "fulfillment:apliiq_hold_release_authorized")).toHaveLength(1);
  });
});

describe("APLIIQ force resubmit — proven absence", () => {
  beforeEach(() => {
    harness.configured.mockReturnValue(true);
    providerMocks.blockReason.mockReturnValue(null);
    queueProvenAbsence();
    harness.selectQueue.push([paidOrder()], [submittedClaim()]);
    harness.updateQueue.push([{ id: 9 }]);
  });

  afterEach(() => {
    harness.selectQueue.length = 0;
    harness.insertQueue.length = 0;
    harness.updateQueue.length = 0;
    harness.calls.length = 0;
    vi.clearAllMocks();
  });

  it("releases the claim by clearing only the request id", async () => {
    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(result).toMatchObject({ outcome: "released", release: "absence_proven", providerRequestId: DETERMINISTIC_ID });
    expect(fulfillmentUpdates()).toHaveLength(1);
    expect(fulfillmentUpdates()[0].set?.providerRequestId).toBeNull();
    expect(fulfillmentUpdates()[0].set?.providerOrderId).toBeUndefined();
    expect(auditActions()).toContain("fulfillment:apliiq_resubmit_authorized");
  });

  it("authorizes the same one-shot release, so the ordinary retry path can act on it", async () => {
    // Clearing providerRequestId alone is not enough any more: an unauthorized
    // NULL row is inert, which is exactly what stops the cron mass-releasing.
    // The proof and the authorization therefore land in the same statement.
    await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(writtenAuthorization(fulfillmentUpdates()[0])).toMatchObject({
      authorizedBy: "ops:apliiq-force-resubmit",
      basis: "absence_proven",
      releasedFrom: "manual_review",
    });
  });

  it("performs every documented lookup before releasing anything", async () => {
    let updatesWhenListed = -1;
    providerMocks.listOrders.mockImplementation(async () => {
      updatesWhenListed = fulfillmentUpdates().length;
      return [];
    });

    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);

    expect(updatesWhenListed).toBe(0); // nothing was written before the proof ran
    expect(providerMocks.getOrder).toHaveBeenCalledTimes(2);
    expect(providerMocks.getOrder.mock.calls.map((call) => call[1])).toEqual([DETERMINISTIC_ID, EXTERNAL]);
    // Default recent window plus an explicit wide window, because a break-glass
    // resubmission can happen long after checkout.
    expect(providerMocks.listOrders).toHaveBeenCalledTimes(2);
    expect(providerMocks.listOrders.mock.calls.map((call) => call[1])).toEqual([undefined, new Date().getUTCFullYear()]);
    expect(result).toMatchObject({ outcome: "released" });
  });

  it("records the evidence that justified the release", async () => {
    const result = await forceResubmitApliiqFulfillment(ORDER_ID, client);
    if (result.outcome !== "released") throw new Error("expected a released outcome");

    expect(result.evidence.recordsScanned).toBe(0);
    expect(result.evidence.lookups).toHaveLength(4);
    expect(result.evidence.lookups[0]).toContain("404");
    expect(Number.isNaN(Date.parse(result.evidence.checkedAt))).toBe(false);

    const audited = harness.calls.find((call) => call.op === "insert" && call.table === auditLog);
    expect(audited?.values?.metadataJson).toMatchObject({
      provider: "apliiq",
      providerRequestId: DETERMINISTIC_ID,
      evidence: { lookups: result.evidence.lookups },
    });
  });

  it("guards the release UPDATE on the exact request id it proved absent", async () => {
    await forceResubmitApliiqFulfillment(ORDER_ID, client);
    const where = fulfillmentUpdates()[0].where as { queryChunks?: unknown[] } | undefined;
    const columns: string[] = [];
    const walk = (node: unknown, depth = 0): void => {
      if (depth > 16 || node === null || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (typeof record.name === "string" && typeof record.columnType === "string") { columns.push(record.name); return; }
      if (Array.isArray(record.queryChunks)) record.queryChunks.forEach((chunk) => walk(chunk, depth + 1));
    };
    walk(where);
    expect(columns).toEqual(["id", "provider_request_id", "provider_order_id"]);
  });
});
