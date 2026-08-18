import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ squareRequest: vi.fn() }));

vi.mock("@/lib/square/client", () => ({ squareRequest: mocks.squareRequest }));

import {
  SQUARE_REFUND_REASON_MAX_LENGTH,
  SquareRefundError,
  parseSquareRefund,
  refundSquarePayment,
} from "@/lib/square/refunds";

const completedRefund = {
  id: "refund-1",
  status: "COMPLETED",
  payment_id: "payment-1",
  amount_money: { amount: 1500, currency: "USD" },
  reason: "Provider could not fulfil",
};

describe("Square refund payload parsing", () => {
  it("rejects payloads that cannot fund a money decision", () => {
    expect(parseSquareRefund(null)).toBeNull();
    expect(parseSquareRefund(undefined)).toBeNull();
    expect(parseSquareRefund({ status: "COMPLETED", payment_id: "payment-1", amount_money: { amount: 100 } })).toBeNull();
    expect(parseSquareRefund({ id: "refund-1", status: "COMPLETED", amount_money: { amount: 100 } })).toBeNull();
    expect(parseSquareRefund({ id: "refund-1", status: "COMPLETED", payment_id: "payment-1" })).toBeNull();
    expect(parseSquareRefund({ ...completedRefund, amount_money: { amount: 0 } })).toBeNull();
    expect(parseSquareRefund({ ...completedRefund, amount_money: { amount: 12.5 } })).toBeNull();
  });

  it("treats only COMPLETED as money that has actually moved", () => {
    expect(parseSquareRefund(completedRefund)?.completed).toBe(true);
    for (const status of ["PENDING", "REJECTED", "FAILED", ""]) {
      const parsed = parseSquareRefund({ ...completedRefund, status });
      expect(parsed).not.toBeNull();
      expect(parsed?.completed).toBe(false);
      expect(parsed?.status).toBe(status);
    }
  });

  it("keeps Square's own amount so a partial refund is never rounded up", () => {
    expect(parseSquareRefund({ ...completedRefund, amount_money: { amount: 499 } })).toEqual({
      refundId: "refund-1",
      status: "COMPLETED",
      completed: true,
      paymentId: "payment-1",
      amountCents: 499,
      currency: "USD",
      reason: "Provider could not fulfil",
    });
  });

  it("defaults a missing currency and a missing reason", () => {
    const parsed = parseSquareRefund({ id: "r", status: "COMPLETED", payment_id: "p", amount_money: { amount: 1 } });
    expect(parsed?.currency).toBe("USD");
    expect(parsed?.reason).toBeNull();
  });
});

describe("issuing a Square refund", () => {
  beforeEach(() => {
    mocks.squareRequest.mockResolvedValue({ refund: completedRefund });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mocks.squareRequest.mockReset();
  });

  it("posts an uncached partial refund against the captured payment", async () => {
    const refund = await refundSquarePayment({
      paymentId: "payment-1",
      amountCents: 1500,
      currency: "USD",
      reason: "Provider could not fulfil",
      idempotencyKey: "ops-key-1",
    });

    expect(mocks.squareRequest).toHaveBeenCalledWith("/refunds", {
      method: "POST",
      revalidate: 0,
      body: {
        idempotency_key: "ops-key-1",
        payment_id: "payment-1",
        amount_money: { amount: 1500, currency: "USD" },
        reason: "Provider could not fulfil",
      },
    });
    expect(refund.refundId).toBe("refund-1");
    expect(refund.completed).toBe(true);
  });

  it("generates an idempotency key when the caller does not supply one", async () => {
    await refundSquarePayment({ paymentId: "payment-1", amountCents: 1500, reason: "test" });
    const body = mocks.squareRequest.mock.calls[0][1].body as { idempotency_key: string };
    expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("refuses to send an unusable refund before touching Square", async () => {
    const invalid = [
      { paymentId: "", amountCents: 100, reason: "r" },
      { paymentId: "payment-1", amountCents: 0, reason: "r" },
      { paymentId: "payment-1", amountCents: -100, reason: "r" },
      { paymentId: "payment-1", amountCents: 10.5, reason: "r" },
      { paymentId: "payment-1", amountCents: 100, reason: "   " },
    ];
    for (const input of invalid) {
      await expect(refundSquarePayment(input)).rejects.toBeInstanceOf(SquareRefundError);
    }
    expect(mocks.squareRequest).not.toHaveBeenCalled();
  });

  it("truncates the reason to Square's limit instead of being rejected by Square", async () => {
    await refundSquarePayment({ paymentId: "payment-1", amountCents: 100, reason: "x".repeat(400) });
    const body = mocks.squareRequest.mock.calls[0][1].body as { reason: string };
    expect(body.reason).toHaveLength(SQUARE_REFUND_REASON_MAX_LENGTH);
  });

  it("throws when Square answers without a usable refund object", async () => {
    mocks.squareRequest.mockResolvedValue({ refund: { id: "refund-1", status: "COMPLETED" } });
    await expect(
      refundSquarePayment({ paymentId: "payment-1", amountCents: 100, reason: "r" }),
    ).rejects.toBeInstanceOf(SquareRefundError);
  });
});
