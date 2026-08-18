// Square refunds (POST /v2/refunds) — the only outbound path that returns money
// to a shopper. app/api/create-payment/route.ts charges with autocomplete:true,
// so every payment is CAPTURED, not authorized: there is nothing to void and a
// refund is the only remedy when fulfillment cannot be completed.
//
// Nothing here touches the database. Issuing the refund and recording it are
// deliberately separate steps so the persistence side can run as a single
// transaction (recordOrderRefund in lib/commerce/webhooks.ts).
//
// Square refund lifecycle: PENDING -> COMPLETED, or PENDING -> REJECTED/FAILED.
// Only COMPLETED means the money actually moved, so callers gate on `completed`
// rather than on "the call did not throw". A PENDING refund is finished by the
// refund.updated webhook, which applies the same COMPLETED gate.
import { squareRequest } from "./client";

/** The only Square refund status that means money has actually moved. */
export const SQUARE_REFUND_COMPLETED = "COMPLETED";

/** Square rejects a `reason` longer than 192 characters. */
export const SQUARE_REFUND_REASON_MAX_LENGTH = 192;

/** Raised for a refund we refuse to send, or a Square response we cannot trust. */
export class SquareRefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SquareRefundError";
  }
}

interface SquareMoney {
  amount?: number;
  currency?: string;
}

/** The raw Square Refund object, as returned by /v2/refunds and by refund.* webhooks. */
export interface SquareRefundObject {
  id?: string;
  status?: string;
  payment_id?: string;
  order_id?: string;
  amount_money?: SquareMoney;
  reason?: string;
}

export interface SquareRefund {
  refundId: string;
  /** PENDING | COMPLETED | REJECTED | FAILED — Square's verbatim status. */
  status: string;
  /** True only for SQUARE_REFUND_COMPLETED. Never infer this from `status` again. */
  completed: boolean;
  paymentId: string;
  /** Square's authoritative refunded amount, which may differ from what we asked for. */
  amountCents: number;
  currency: string;
  reason: string | null;
}

/**
 * Normalize a Square Refund object. Returns null when the payload cannot fund a
 * money decision — no refund id, no payment id, or no usable amount. A partial
 * refund is a first-class outcome here: the amount is read, never assumed to be
 * the order total.
 */
export function parseSquareRefund(refund: SquareRefundObject | null | undefined): SquareRefund | null {
  if (!refund || typeof refund !== "object") return null;
  const refundId = String(refund.id ?? "").trim();
  const paymentId = String(refund.payment_id ?? "").trim();
  const amountCents = refund.amount_money?.amount;
  if (!refundId || !paymentId) return null;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents < 1) return null;

  const status = String(refund.status ?? "").trim();
  return {
    refundId,
    status,
    completed: status === SQUARE_REFUND_COMPLETED,
    paymentId,
    amountCents,
    currency: String(refund.amount_money?.currency ?? "") || "USD",
    reason: refund.reason ? String(refund.reason) : null,
  };
}

export interface RefundSquarePaymentInput {
  /** orders.square_payment_id — the captured payment being refunded. */
  paymentId: string;
  /** Partial refunds are supported; must be a positive whole number of cents. */
  amountCents: number;
  currency?: string;
  reason: string;
  /** Reuse to make an ops retry safe. A fresh UUID otherwise, matching createPricedSquareOrder. */
  idempotencyKey?: string;
}

/** POST /v2/refunds. Throws SquareRefundError for anything we refuse to send or cannot parse. */
export async function refundSquarePayment(input: RefundSquarePaymentInput): Promise<SquareRefund> {
  const paymentId = String(input.paymentId ?? "").trim();
  if (!paymentId) throw new SquareRefundError("A Square payment id is required to refund.");
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) {
    throw new SquareRefundError("Refund amount must be a positive whole number of cents.");
  }
  const reason = String(input.reason ?? "").trim().slice(0, SQUARE_REFUND_REASON_MAX_LENGTH);
  if (!reason) throw new SquareRefundError("A refund reason is required.");

  const response = await squareRequest<{ refund?: SquareRefundObject }>("/refunds", {
    method: "POST",
    revalidate: 0,
    body: {
      idempotency_key: input.idempotencyKey || crypto.randomUUID(),
      payment_id: paymentId,
      amount_money: { amount: input.amountCents, currency: input.currency || "USD" },
      reason,
    },
  });

  const refund = parseSquareRefund(response.refund);
  if (!refund) throw new SquareRefundError("Square did not return a usable refund object.");
  return refund;
}
