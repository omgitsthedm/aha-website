// B2: a gate-held APLIIQ order must be releasable once the gates open — and
// releasing it must be a per-order human act, never a side effect of the flip.
//
// Before the B2 fix, holdApliiqFulfillment inserted a manual_review row with NO
// providerRequestId and every later entry point (create-payment, the 15-minute
// cron, the ops retry button) hit the terminal branch, rewrote manual_review and
// returned. A paid order could never be submitted without database surgery.
//
// The first cut of the fix released on NULL providerRequestId alone, which made
// the cron a bulk submitter: flip APLIIQ_LIVE_MODE and the whole held backlog
// goes to APLIIQ unattended, at APLIIQ's processing-time card charge. So there
// are now two keys, and these tests pin both:
//
//   1. SAFE — providerRequestId is written in the same INSERT that claims the
//      row, strictly before the only create POST. NULL therefore proves no
//      request was ever issued and a submission cannot duplicate.
//   2. AUTHORIZED — a live per-order ops authorization in providerDataJson,
//      written only by forceResubmitApliiqFulfillment, consumed by the first
//      submission and expiring on its own.
//
// Automatic callers can only ever consume key 2. They never write one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditLog, fulfillments, orders } from "@/db/schema";
import type { OrderContact, RevalidatedCart } from "@/lib/commerce/orders";

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
  submit: vi.fn(),
  blockReason: vi.fn<() => string | null>(() => null),
  allowed: vi.fn(() => true),
  client: vi.fn(() => ({ request: vi.fn(), requestWithMetadata: vi.fn() })),
}));

vi.mock("@/lib/db/client", () => ({ db: harness.db, isDbConfigured: harness.configured }));

vi.mock("@/lib/commerce/notifications", () => ({
  enqueueOrderNotification: vi.fn(async () => undefined),
  dispatchOrderNotifications: vi.fn(async () => undefined),
}));

vi.mock("@/lib/fulfillment/apliiq-adapter", () => ({
  submitApliiqFulfillment: providerMocks.submit,
  getApliiqSubmissionBlockReason: providerMocks.blockReason,
  isApliiqSubmissionAllowed: providerMocks.allowed,
  createLiveApliiqClient: providerMocks.client,
}));

import { APLIIQ_HOLD_RELEASE_TTL_MS, forceResubmitApliiqFulfillment, startFulfillment } from "@/lib/commerce/fulfillment";

const ORDER_ID = 77;
const EXTERNAL = "AHA-10077";
const DETERMINISTIC_ID = `aha-apliiq-${ORDER_ID}`;

const cart: RevalidatedCart = {
  currency: "USD",
  subtotal: 6500,
  items: [{
    ahaProductId: "aha-night-shift",
    ahaVariantId: "aha-night-shift-m",
    sku: "AHA-NS-M",
    title: "Night Shift Tee",
    size: "M",
    quantity: 1,
    unitPrice: 6500,
    lineTotal: 6500,
    squareVariationId: "sq-var-1",
    fulfillmentProvider: "apliiq",
    providerSku: "APQ-4633445S6A1",
    providerSnapshot: { apliiqSku: "APQ-4633445S6A1" },
  }],
};

const contact: OrderContact = {
  email: "shopper@example.test",
  shippingName: "Ada Lovelace",
  shippingAddress: { address1: "1 Main St", city: "Brooklyn", state: "NY", zip: "11201", country: "US" },
};

/** The order row startApliiqFulfillment reads first. */
function paidOrder(overrides: Record<string, unknown> = {}) {
  return { externalOrderNumber: EXTERNAL, paymentStatus: "paid", squarePaymentId: "sq-pay-1", ...overrides };
}

/** What forceResubmitApliiqFulfillment writes onto the row it authorizes. */
function authorization(overrides: Record<string, unknown> = {}) {
  return {
    authorizedAt: new Date().toISOString(),
    authorizedBy: "ops:apliiq-force-resubmit",
    basis: "never_submitted",
    releasedFrom: "manual_review",
    ...overrides,
  };
}

/** A gate-held claim: no request id, so provably never POSTed. */
function heldClaim(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    providerRequestId: null,
    providerOrderId: null,
    providerDataJson: null as unknown,
    status: "manual_review",
    ...overrides,
  };
}

function authorizedClaim(overrides: Record<string, unknown> = {}) {
  return heldClaim({ providerDataJson: { apliiqHoldRelease: authorization() }, ...overrides });
}

function auditActions(): string[] {
  return harness.calls
    .filter((call) => call.op === "insert" && call.table === auditLog)
    .map((call) => String(call.values?.action ?? ""));
}

function fulfillmentUpdates(): DbCall[] {
  return harness.calls.filter((call) => call.op === "update" && call.table === fulfillments);
}

function fulfillmentInserts(): DbCall[] {
  return harness.calls.filter((call) => call.op === "insert" && call.table === fulfillments);
}

/**
 * Flatten a drizzle predicate to readable SQL. The reclaim's atomicity lives
 * entirely in its WHERE clause, so it has to be asserted structurally — a
 * result-shape assertion alone would still pass if the guards were dropped.
 */
function describeSql(node: unknown, depth = 0): string {
  if (depth > 16 || node === null || node === undefined) return "";
  if (Array.isArray(node)) return node.map((chunk) => describeSql(chunk, depth + 1)).join("");
  if (typeof node !== "object") return String(node);
  const record = node as Record<string, unknown>;
  if (typeof record.name === "string" && typeof record.columnType === "string") return record.name;
  if (Array.isArray(record.queryChunks)) return describeSql(record.queryChunks, depth + 1);
  if (Array.isArray(record.value)) return record.value.join("");
  if (record.value !== undefined) return "?";
  return "";
}

describe("APLIIQ gate-hold release — authorized", () => {
  beforeEach(() => {
    harness.configured.mockReturnValue(true);
    providerMocks.blockReason.mockReturnValue(null);
    providerMocks.allowed.mockReturnValue(true);
    providerMocks.submit.mockResolvedValue({ outcome: "processed", providerOrderId: "apliiq-9001" });
  });

  afterEach(() => {
    harness.selectQueue.length = 0;
    harness.insertQueue.length = 0;
    harness.updateQueue.length = 0;
    harness.calls.length = 0;
    vi.clearAllMocks();
  });

  it("reclaims an ops-authorized held row and submits it once", async () => {
    harness.selectQueue.push([paidOrder()], [authorizedClaim()], [{ status: "draft_created" }]);
    harness.updateQueue.push([{ id: 9 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).toHaveBeenCalledTimes(1);
    expect(providerMocks.submit.mock.calls[0][1]).toMatchObject({
      orderId: ORDER_ID,
      externalOrderNumber: EXTERNAL,
      providerRequestId: DETERMINISTIC_ID,
    });
    expect(fulfillmentUpdates()[0].set).toMatchObject({
      providerRequestId: DETERMINISTIC_ID,
      status: "draft_creating",
      lastError: null,
    });
    expect(auditActions()).toContain("fulfillment:apliiq_hold_released");
    // The old terminal branch is what made this unfixable without DB surgery.
    expect(auditActions()).not.toContain("fulfillment:apliiq_manual_reconciliation_required");
  });

  it("releases an authorized hold that was taken before the Square payment id landed", async () => {
    // lib/commerce/webhooks.ts sets paymentStatus 'paid' without squarePaymentId,
    // which trips the same hold. Once the id lands and ops releases it, it ships.
    harness.selectQueue.push(
      [paidOrder({ squarePaymentId: "sq-pay-late" })],
      [authorizedClaim({ id: 11 })],
      [{ status: "draft_created" }],
    );
    harness.updateQueue.push([{ id: 11 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).toHaveBeenCalledTimes(1);
    expect(fulfillmentUpdates()[0].set?.lastError).toBeNull();
  });

  it("consumes the authorization in the claiming UPDATE, so one release buys one submission", async () => {
    harness.selectQueue.push(
      [paidOrder()],
      [authorizedClaim({ providerDataJson: { apliiqHoldRelease: authorization(), keepMe: true } })],
      [{ status: "draft_created" }],
    );
    harness.updateQueue.push([{ id: 9 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    const written = fulfillmentUpdates()[0].set?.providerDataJson as Record<string, unknown>;
    expect(written).toEqual({ keepMe: true });
    expect(written).not.toHaveProperty("apliiqHoldRelease");
  });

  it("clears providerDataJson entirely when the authorization was all it held", async () => {
    harness.selectQueue.push([paidOrder()], [authorizedClaim()], [{ status: "draft_created" }]);
    harness.updateQueue.push([{ id: 9 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(fulfillmentUpdates()[0].set?.providerDataJson).toBeNull();
  });

  it("reuses the deterministic request id, so a release and a fresh claim are indistinguishable to APLIIQ", async () => {
    harness.selectQueue.push([paidOrder()], [authorizedClaim()], [{ status: "draft_created" }]);
    harness.updateQueue.push([{ id: 9 }]);
    await startFulfillment(ORDER_ID, cart, contact);
    const releasedId = fulfillmentUpdates()[0].set?.providerRequestId;

    harness.selectQueue.length = 0;
    harness.updateQueue.length = 0;
    harness.calls.length = 0;
    harness.selectQueue.push([paidOrder()], [], [{ status: "draft_created" }]);
    harness.insertQueue.push([{ id: 12 }]);
    await startFulfillment(ORDER_ID, cart, contact);
    const freshId = fulfillmentInserts()[0].values?.providerRequestId;

    expect(releasedId).toBe(DETERMINISTIC_ID);
    expect(freshId).toBe(DETERMINISTIC_ID);
  });

  it("guards the reclaim with a conditional UPDATE so two requests cannot both submit", async () => {
    harness.selectQueue.push([paidOrder()], [authorizedClaim()], [{ status: "draft_created" }]);
    harness.updateQueue.push([{ id: 9 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    const where = describeSql(fulfillmentUpdates()[0].where);
    expect(where).toContain("provider_request_id is null");
    expect(where).toContain("provider_order_id is null");
    // The authorization requirement is in the statement itself, not only in the
    // TypeScript guard above it.
    expect(where).toContain("provider_data_json -> 'apliiqHoldRelease' is not null");
  });

  it("does not submit when a concurrent request wins the reclaim", async () => {
    harness.selectQueue.push([paidOrder()], [authorizedClaim()], [{ status: "manual_review" }]);
    harness.updateQueue.push([]); // the conditional UPDATE matched no row

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(auditActions()).not.toContain("fulfillment:apliiq_hold_released");
  });

  it("round-trips a real ops release: authorized once, submitted once, then spent", async () => {
    // Both halves of the fix in one pass, using the real writer and the real
    // reader rather than a hand-built marker: the ops call is what makes the
    // held row releasable at all (no DB surgery), and what it writes is good for
    // exactly one submission.
    harness.selectQueue.push([paidOrder()], [heldClaim()]);
    harness.updateQueue.push([{ id: 9 }]);
    const release = await forceResubmitApliiqFulfillment(ORDER_ID);
    expect(release).toMatchObject({ outcome: "released", release: "hold_authorized" });
    const authorized = fulfillmentUpdates()[0].set?.providerDataJson;
    expect(authorized).toHaveProperty("apliiqHoldRelease");

    harness.calls.length = 0;
    harness.selectQueue.push([paidOrder()], [heldClaim({ providerDataJson: authorized })], [{ status: "draft_created" }]);
    harness.updateQueue.push([{ id: 9 }]);
    await startFulfillment(ORDER_ID, cart, contact);
    expect(providerMocks.submit).toHaveBeenCalledTimes(1);
    const spent = fulfillmentUpdates()[0].set?.providerDataJson;

    harness.calls.length = 0;
    harness.selectQueue.push([paidOrder()], [heldClaim({ providerDataJson: spent })], [{ status: "manual_review" }]);
    await startFulfillment(ORDER_ID, cart, contact);
    expect(providerMocks.submit).toHaveBeenCalledTimes(1); // still one, not two
    expect(fulfillmentUpdates()).toHaveLength(0);
  });
});

describe("APLIIQ gate-hold release — automatic callers cannot release", () => {
  beforeEach(() => {
    harness.configured.mockReturnValue(true);
    // The gates are OPEN throughout this block. That is the whole point: an open
    // gate is permission for NEW orders, not a release for the held backlog.
    providerMocks.blockReason.mockReturnValue(null);
    providerMocks.allowed.mockReturnValue(true);
    providerMocks.submit.mockResolvedValue({ outcome: "processed", providerOrderId: "apliiq-9001" });
  });

  afterEach(() => {
    harness.selectQueue.length = 0;
    harness.insertQueue.length = 0;
    harness.updateQueue.length = 0;
    harness.calls.length = 0;
    vi.clearAllMocks();
  });

  it("submits nothing when the gates flip with a backlog of held orders", async () => {
    // The reported failure: an operator flips APLIIQ_ALLOW_CREATE_ORDERS and
    // APLIIQ_LIVE_MODE to push ONE test order through, and within 15 minutes the
    // reconcile cron pushes the whole accumulated backlog instead.
    const backlog = [101, 102, 103, 104, 105];
    backlog.forEach((_orderId, index) => {
      harness.selectQueue.push(
        [paidOrder({ externalOrderNumber: `AHA-${10100 + index}` })],
        [heldClaim({ id: 900 + index })],
        [{ status: "manual_review" }],
      );
    });

    for (const orderId of backlog) {
      await startFulfillment(orderId, cart, contact);
    }

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(fulfillmentUpdates()).toHaveLength(0);
    expect(fulfillmentInserts()).toHaveLength(0);
    expect(auditActions()).toEqual([]);
  });

  it("leaves an unauthorized held row completely untouched", async () => {
    harness.selectQueue.push([paidOrder()], [heldClaim()], [{ status: "manual_review" }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(fulfillmentUpdates()).toHaveLength(0);
    // No audit churn either: the cron revisits this row every 15 minutes.
    expect(auditActions()).toEqual([]);
  });

  it("refuses an authorization that has expired", async () => {
    const stale = new Date(Date.now() - APLIIQ_HOLD_RELEASE_TTL_MS - 1_000).toISOString();
    harness.selectQueue.push(
      [paidOrder()],
      [authorizedClaim({ providerDataJson: { apliiqHoldRelease: authorization({ authorizedAt: stale }) } })],
      [{ status: "manual_review" }],
    );

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(fulfillmentUpdates()).toHaveLength(0);
  });

  it("still honours an authorization inside its window", async () => {
    const recent = new Date(Date.now() - APLIIQ_HOLD_RELEASE_TTL_MS + 60_000).toISOString();
    harness.selectQueue.push(
      [paidOrder()],
      [authorizedClaim({ providerDataJson: { apliiqHoldRelease: authorization({ authorizedAt: recent }) } })],
      [{ status: "draft_created" }],
    );
    harness.updateQueue.push([{ id: 9 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).toHaveBeenCalledTimes(1);
  });

  it("refuses an authorization dated into the future by a skewed clock", async () => {
    const future = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    harness.selectQueue.push(
      [paidOrder()],
      [authorizedClaim({ providerDataJson: { apliiqHoldRelease: authorization({ authorizedAt: future }) } })],
      [{ status: "manual_review" }],
    );

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["a bare truthy value", { apliiqHoldRelease: true }],
    ["a missing timestamp", { apliiqHoldRelease: { authorizedBy: "ops:apliiq-force-resubmit" } }],
    ["an unparseable timestamp", { apliiqHoldRelease: { authorizedAt: "whenever" } }],
    ["an unrelated provider payload", { latestWebhook: { status: "shipped" } }],
  ])("refuses a malformed authorization: %s", async (_label, providerDataJson) => {
    harness.selectQueue.push([paidOrder()], [heldClaim({ providerDataJson })], [{ status: "manual_review" }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(fulfillmentUpdates()).toHaveLength(0);
  });
});

describe("APLIIQ gate-hold release — unchanged claim rules", () => {
  beforeEach(() => {
    harness.configured.mockReturnValue(true);
    providerMocks.blockReason.mockReturnValue(null);
    providerMocks.allowed.mockReturnValue(true);
    providerMocks.submit.mockResolvedValue({ outcome: "processed", providerOrderId: "apliiq-9001" });
  });

  afterEach(() => {
    harness.selectQueue.length = 0;
    harness.insertQueue.length = 0;
    harness.updateQueue.length = 0;
    harness.calls.length = 0;
    vi.clearAllMocks();
  });

  it("still refuses a claim that already carries a providerRequestId", async () => {
    harness.selectQueue.push(
      [paidOrder()],
      [heldClaim({ providerRequestId: DETERMINISTIC_ID, status: "draft_creating" })],
      [{ status: "manual_review" }],
    );

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(auditActions()).toContain("fulfillment:apliiq_manual_reconciliation_required");
  });

  it("refuses a submitted claim even when it carries a live authorization", async () => {
    // A POSTed row is terminal on evidence, not on ceremony: the ops path that
    // writes authorizations proves absence before it clears the request id, so a
    // row that still has one has not been through that proof.
    harness.selectQueue.push(
      [paidOrder()],
      [authorizedClaim({ providerRequestId: DETERMINISTIC_ID, status: "manual_review" })],
      [{ status: "manual_review" }],
    );

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(auditActions()).toContain("fulfillment:apliiq_manual_reconciliation_required");
  });

  it("returns without touching a claim that already has a provider order id", async () => {
    harness.selectQueue.push(
      [paidOrder()],
      [heldClaim({ providerRequestId: DETERMINISTIC_ID, providerOrderId: "apliiq-4242", status: "draft_created" })],
      [{ status: "draft_created" }],
    );

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(fulfillmentUpdates()).toHaveLength(0);
  });

  it("still claims and submits a brand new APLIIQ batch", async () => {
    harness.selectQueue.push([paidOrder()], [], [{ status: "draft_created" }]);
    harness.insertQueue.push([{ id: 21 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(fulfillmentInserts()[0].values).toMatchObject({
      orderId: ORDER_ID,
      fulfillmentProvider: "apliiq",
      providerClaimKey: "apliiq:default",
      providerRequestId: DETERMINISTIC_ID,
      status: "draft_creating",
    });
    expect(providerMocks.submit).toHaveBeenCalledTimes(1);
    expect(auditActions()).toContain("fulfillment:apliiq_claimed");
  });

  it("does not submit when a concurrent request wins the fresh insert", async () => {
    harness.selectQueue.push([paidOrder()], [], [{ status: "manual_review" }]);
    harness.insertQueue.push([]); // onConflictDoNothing returned no row

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
  });

  it("still holds without a request id while the submission gates are closed", async () => {
    providerMocks.allowed.mockReturnValue(false);
    providerMocks.blockReason.mockReturnValue("APLIIQ order submission requires APLIIQ_LIVE_MODE=true.");
    harness.selectQueue.push([paidOrder()], [{ status: "manual_review" }]);
    harness.insertQueue.push([{ id: 5 }]);

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    const held = fulfillmentInserts()[0].values ?? {};
    expect(held).toMatchObject({ providerClaimKey: "apliiq:default", status: "manual_review" });
    // NULL providerRequestId is the safety half of the release condition.
    expect(held.providerRequestId).toBeUndefined();
    // And the hold never writes its own authorization — only ops can.
    expect(held.providerDataJson).toBeUndefined();
  });

  it("holds again rather than releasing when a held order is retried while the gates are shut", async () => {
    providerMocks.allowed.mockReturnValue(false);
    providerMocks.blockReason.mockReturnValue("APLIIQ order submission requires APLIIQ_LIVE_MODE=true.");
    harness.selectQueue.push([paidOrder()], [{ status: "manual_review" }]);
    harness.insertQueue.push([]); // the hold row already exists

    await startFulfillment(ORDER_ID, cart, contact);

    expect(providerMocks.submit).not.toHaveBeenCalled();
    expect(fulfillmentUpdates()).toHaveLength(0);
  });
});
