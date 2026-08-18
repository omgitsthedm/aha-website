import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpsSessionToken } from "@/lib/ops/auth";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  configured: vi.fn(() => true),
  orderRows: [] as unknown[],
  refund: vi.fn(),
  record: vi.fn(),
  notePending: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mocks.cookieValue ? { value: mocks.cookieValue } : undefined) }),
}));

vi.mock("@/lib/db/client", () => ({
  isDbConfigured: mocks.configured,
  db: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(mocks.orderRows) }) }) }),
  }),
}));

vi.mock("@/lib/square/refunds", () => ({ refundSquarePayment: mocks.refund }));

// Only the two persistence entry points are stubbed; calculateProviderRecoveryCents
// stays real so the route's tier arithmetic is exercised end to end.
vi.mock("@/lib/commerce/webhooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/commerce/webhooks")>()),
  recordOrderRefund: mocks.record,
  noteOrderRefundPending: mocks.notePending,
}));

import { POST } from "@/app/api/ops/orders/[id]/refund/route";

const previousSecret = process.env.AHA_OPS_SESSION_SECRET;

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    currency: "USD",
    totalAmount: 12000,
    refundedAmountCents: 0,
    paymentStatus: "paid",
    squarePaymentId: "payment-1",
    ...overrides,
  };
}

function post(body: unknown, id = "7") {
  return POST(
    new Request("https://afterhoursagenda.test/api/ops/orders/7/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  process.env.AHA_OPS_SESSION_SECRET = "test-ops-session-secret";
  mocks.cookieValue = createOpsSessionToken();
  mocks.configured.mockReturnValue(true);
  mocks.orderRows = [order()];
  mocks.refund.mockResolvedValue({
    refundId: "refund-1", status: "COMPLETED", completed: true,
    paymentId: "payment-1", amountCents: 12000, currency: "USD", reason: null,
  });
  mocks.record.mockResolvedValue({
    applied: true, orderId: 7, refundedAmountCents: 12000, paymentStatus: "refunded",
  });
  mocks.notePending.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  if (previousSecret === undefined) delete process.env.AHA_OPS_SESSION_SECRET;
  else process.env.AHA_OPS_SESSION_SECRET = previousSecret;
});

describe("ops refund route authentication", () => {
  it("404s without a valid ops session and never reaches Square", async () => {
    mocks.cookieValue = undefined;
    expect((await post({ reason: "test" })).status).toBe(404);

    mocks.cookieValue = "v2.9999999999999.forged";
    expect((await post({ reason: "test" })).status).toBe(404);
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});

describe("ops refund route validation", () => {
  it("rejects a bad order id, a bad body and a missing reason", async () => {
    expect((await post({ reason: "test" }, "abc")).status).toBe(400);
    expect((await post("not-json")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ reason: "   " })).status).toBe(400);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("503s when the order store is unavailable", async () => {
    mocks.configured.mockReturnValue(false);
    expect((await post({ reason: "test" })).status).toBe(503);
  });

  it("404s an unknown order", async () => {
    mocks.orderRows = [];
    expect((await post({ reason: "test" })).status).toBe(404);
  });

  it("refuses an order with nothing captured to refund", async () => {
    mocks.orderRows = [order({ squarePaymentId: null })];
    expect((await post({ reason: "test" })).status).toBe(409);

    mocks.orderRows = [order({ paymentStatus: "created" })];
    expect((await post({ reason: "test" })).status).toBe(409);

    mocks.orderRows = [order({ paymentStatus: "payment_failed" })];
    expect((await post({ reason: "test" })).status).toBe(409);

    mocks.orderRows = [order({ refundedAmountCents: 12000 })];
    expect((await post({ reason: "test" })).status).toBe(409);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("refunds only what is still refundable", async () => {
    mocks.orderRows = [order({ refundedAmountCents: 4000, paymentStatus: "partially_refunded" })];
    expect((await post({ reason: "test", amountCents: 8001 })).status).toBe(400);
    expect((await post({ reason: "test", amountCents: 0 })).status).toBe(400);
    expect((await post({ reason: "test", amountCents: 10.5 })).status).toBe(400);
    expect(mocks.refund).not.toHaveBeenCalled();

    await post({ reason: "test" });
    expect(mocks.refund).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 8000 }));
  });

  it("passes a partial amount through to Square", async () => {
    mocks.refund.mockResolvedValue({
      refundId: "refund-1", status: "COMPLETED", completed: true,
      paymentId: "payment-1", amountCents: 500, currency: "USD", reason: null,
    });
    mocks.record.mockResolvedValue({
      applied: true, orderId: 7, refundedAmountCents: 500, paymentStatus: "partially_refunded",
    });

    const response = await post({ reason: "Damaged print", amountCents: 500 });

    expect(mocks.refund).toHaveBeenCalledWith({
      paymentId: "payment-1", amountCents: 500, currency: "USD",
      reason: "Damaged print", idempotencyKey: undefined,
    });
    expect(await response.json()).toMatchObject({ applied: true, paymentStatus: "partially_refunded" });
    // The ledger records Square's amount, not ours.
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 500 }));
  });
});

describe("ops refund route provider recovery", () => {
  const providerCosts = { productCents: 2000, shippingCents: 596 };

  it("reconciles each APLIIQ cancellation tier", async () => {
    const expected: Record<string, number> = { pre_garment: 2596, post_garment: 996, post_print: 596 };
    for (const [recoveryTier, recovered] of Object.entries(expected)) {
      mocks.record.mockClear();
      await post({ reason: "test", provider: { recoveryTier, outcome: "refunded", ...providerCosts } });
      expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
        providerRecoveryTier: recoveryTier, recoveredAmountCents: recovered,
      }));
    }
  });

  it("treats a same-day VOID and a later REFUND as the same recovery", async () => {
    await post({ reason: "test", provider: { recoveryTier: "pre_garment", outcome: "voided", ...providerCosts } });
    const voided = mocks.record.mock.calls[0][0];
    mocks.record.mockClear();
    await post({ reason: "test", provider: { recoveryTier: "pre_garment", outcome: "refunded", ...providerCosts } });
    const refunded = mocks.record.mock.calls[0][0];

    expect(voided.recoveredAmountCents).toBe(refunded.recoveredAmountCents);
    expect(voided.metadata).toMatchObject({ providerOutcome: "voided" });
    expect(refunded.metadata).toMatchObject({ providerOutcome: "refunded" });
  });

  it("lets the provider receipt override the modelled tier amount", async () => {
    await post({
      reason: "test",
      provider: { recoveryTier: "post_garment", outcome: "refunded", ...providerCosts, recoveredAmountCents: 1234 },
    });
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ recoveredAmountCents: 1234 }));
  });

  it("leaves recovery NULL when the provider leg has not been attempted", async () => {
    await post({ reason: "test" });
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      providerRecoveryTier: null, recoveredAmountCents: null,
    }));

    mocks.record.mockClear();
    await post({ reason: "test", provider: { recoveryTier: "post_print", outcome: "not_attempted" } });
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ recoveredAmountCents: null }));
  });

  it("refuses to model a recovery it cannot compute, so 0 always means 'recovered nothing'", async () => {
    expect((await post({ reason: "test", provider: { recoveryTier: "post_print", outcome: "refunded" } })).status).toBe(400);
    expect((await post({ reason: "test", provider: { recoveryTier: "nope", outcome: "refunded" } })).status).toBe(400);
    expect((await post({ reason: "test", provider: { recoveryTier: "post_print", outcome: "sideways" } })).status).toBe(400);
    expect((await post({ reason: "test", provider: { outcome: "refunded" } })).status).toBe(400);
    expect((await post({ reason: "test", provider: { recoveryTier: "post_print", outcome: "refunded", shippingCents: -1 } })).status).toBe(400);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("records a reconciled zero recovery when the receipt says nothing came back", async () => {
    await post({ reason: "test", provider: { recoveryTier: "post_print", outcome: "refunded", shippingCents: 0 } });
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ recoveredAmountCents: 0 }));
  });
});

describe("ops refund route Square outcomes", () => {
  // PENDING -> COMPLETED is the normal card lifecycle, so everything the
  // operator reconciled has to survive the handoff to the refund.updated
  // webhook. It only carries the square refund id, so anything not parked on
  // the pending row is lost and the ledger books NULL/NULL forever.
  function pending() {
    mocks.refund.mockResolvedValue({
      refundId: "refund-1", status: "PENDING", completed: false,
      paymentId: "payment-1", amountCents: 12000, currency: "USD", reason: null,
    });
  }

  it("does not book money for a refund Square has not settled", async () => {
    pending();

    const response = await post({ reason: "test" });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ applied: false, status: "PENDING" });
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.notePending).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 7, status: "PENDING", squareRefundId: "refund-1", amountCents: 12000, actor: "ops",
    }));
  });

  it("parks the whole provider leg on a pending refund so the webhook can book it", async () => {
    pending();

    const response = await post({
      reason: "Printer scorched the front panel",
      provider: { recoveryTier: "post_garment", outcome: "refunded", productCents: 2225, shippingCents: 596 },
    });

    // 596 shipping + 20% of 2225 = 596 + 445 = 1041.
    expect(mocks.notePending).toHaveBeenCalledWith(expect.objectContaining({
      squareRefundId: "refund-1",
      providerRecoveryTier: "post_garment",
      recoveredAmountCents: 1041,
      providerOutcome: "refunded",
      reason: "Printer scorched the front panel",
    }));
    // And it is echoed back, so the operator can see what was handed off.
    expect(await response.json()).toMatchObject({
      providerRecoveryTier: "post_garment",
      recoveredAmountCents: 1041,
      providerOutcome: "refunded",
      providerLegParked: true,
    });
  });

  it("parks a reconciled zero recovery as 0, never as NULL", async () => {
    pending();

    await post({
      reason: "test",
      provider: { recoveryTier: "post_print", outcome: "refunded", shippingCents: 0 },
    });

    const parked = mocks.notePending.mock.calls[0][0];
    expect(parked.recoveredAmountCents).toBe(0);
    expect(parked.recoveredAmountCents).not.toBeNull();
    expect(parked.providerRecoveryTier).toBe("post_print");
  });

  it("parks NULL, not 0, when the provider leg was never attempted", async () => {
    pending();

    await post({ reason: "test" });

    expect(mocks.notePending).toHaveBeenCalledWith(expect.objectContaining({
      providerRecoveryTier: null,
      recoveredAmountCents: null,
      providerOutcome: "not_attempted",
    }));
  });

  it("still returns 202 but flags an unparked leg when the pending note fails", async () => {
    pending();
    mocks.notePending.mockRejectedValue(new Error("audit_log unavailable"));

    const response = await post({
      reason: "test",
      provider: { recoveryTier: "pre_garment", outcome: "voided", productCents: 2225, shippingCents: 596 },
    });

    // The money is already away at Square, so this cannot 500 — but the
    // operator has to be told the provider leg needs re-entering.
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, applied: false, providerLegParked: false });
    expect(body.note).toContain("reconcile");
  });

  // The note used to say the leg "must be re-entered once it settles" while
  // refund_audit_log was INSERT-only, so complying with it achieved nothing.
  // It now has to name a route that exists.
  it("hands the operator the exact route that re-enters an unparked leg", async () => {
    pending();
    mocks.notePending.mockRejectedValue(new Error("audit_log unavailable"));

    const body = await (await post({
      reason: "test",
      provider: { recoveryTier: "pre_garment", outcome: "voided", productCents: 2225, shippingCents: 596 },
    })).json();

    expect(body.reconcilePath).toBe("/api/ops/refunds/refund-1/reconcile");
    expect(body.note).toContain(body.reconcilePath);
    // The route it names is the one that is actually mounted.
    const reconcile = await import("@/app/api/ops/refunds/[refundId]/reconcile/route");
    expect(typeof reconcile.POST).toBe("function");
  });

  it("does not tell the operator to reconcile a leg that parked fine", async () => {
    pending();

    const body = await (await post({
      reason: "test",
      provider: { recoveryTier: "pre_garment", outcome: "voided", productCents: 2225, shippingCents: 596 },
    })).json();

    expect(body).toMatchObject({ providerLegParked: true });
    expect(body.reconcilePath).toBeUndefined();
    expect(body.note).not.toContain("reconcile");
  });

  it("reports a Square rejection as a conflict and an outage as a bad gateway", async () => {
    mocks.refund.mockRejectedValue(new Error("Square API error 400: {}"));
    expect((await post({ reason: "test" })).status).toBe(409);

    mocks.refund.mockRejectedValue(new Error("Square API error 500: {}"));
    expect((await post({ reason: "test" })).status).toBe(502);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("treats a webhook that already recorded the refund as success, not failure", async () => {
    mocks.record.mockResolvedValue({ applied: false, orderId: 7, reason: "already_recorded" });
    const response = await post({ reason: "test" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, applied: false, reason: "already_recorded" });
  });

  it("surfaces a persistence failure instead of claiming the refund landed", async () => {
    mocks.record.mockResolvedValue({ applied: false, orderId: 7, reason: "db_unavailable" });
    const response = await post({ reason: "test" });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
