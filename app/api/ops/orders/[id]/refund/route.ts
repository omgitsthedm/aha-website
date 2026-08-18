// Ops-only outbound refund (B3). app/api/create-payment/route.ts charges with
// autocomplete:true, so the shopper's money is CAPTURED at checkout, and APLIIQ
// auto-processing is deliberately off — the first order waits on a human click.
// If that click never comes, or the provider card fails, this is the only way to
// make the customer whole.
//
// Guarded by the ops session cookie and 404s like every other ops route, so an
// unauthenticated caller cannot even learn the endpoint exists.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { PROVIDER_RECOVERY_TIER, orders, type ProviderRecoveryTier } from "@/db/schema";
import { db, isDbConfigured } from "@/lib/db/client";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";
import {
  calculateProviderRecoveryCents,
  noteOrderRefundPending,
  recordOrderRefund,
} from "@/lib/commerce/webhooks";
import { refundSquarePayment } from "@/lib/square/refunds";

export const dynamic = "force-dynamic";

/**
 * APLIIQ voids a same-calendar-day cancellation (the charge disappears and no
 * refund record is ever created) and refunds a later one. Both return the same
 * money, so both reconcile identically; only "not_attempted" leaves
 * recovered_amount_cents NULL, which means "not reconciled yet", not "nothing
 * came back".
 */
const PROVIDER_OUTCOMES = ["voided", "refunded", "not_attempted"] as const;
type ProviderOutcome = (typeof PROVIDER_OUTCOMES)[number];

interface RefundRequestBody {
  /** Omit for the full remaining refundable balance. */
  amountCents?: number;
  reason?: string;
  idempotencyKey?: string;
  provider?: {
    recoveryTier?: string;
    outcome?: string;
    /** What we paid APLIIQ for the goods, incl. the $1/product fulfillment fee. */
    productCents?: number;
    /** What APLIIQ billed for freight, which is charged separately from product cost. */
    shippingCents?: number;
    /** Overrides the modelled tier math when the provider receipt is in hand. */
    recoveredAmountCents?: number;
  };
}

/**
 * Where an unparked provider leg is re-entered once the refund settles. The
 * pending note used to say the leg "must be re-entered" without saying how, and
 * at the time there was no how: refund_audit_log was INSERT-only. There is now,
 * and the operator is handed the exact path rather than a description of one.
 */
const RECONCILE_PATH = (squareRefundId: string) =>
  `/api/ops/refunds/${encodeURIComponent(squareRefundId)}/reconcile`;

function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId < 1) return badRequest("Invalid order.");
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Production order store is unavailable." }, { status: 503 });
  }

  let body: RefundRequestBody;
  try {
    body = (await request.json()) as RefundRequestBody;
  } catch {
    return badRequest("Invalid JSON body");
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) return badRequest("A refund reason is required.");

  const [order] = await db().select({
    id: orders.id,
    currency: orders.currency,
    totalAmount: orders.totalAmount,
    refundedAmountCents: orders.refundedAmountCents,
    paymentStatus: orders.paymentStatus,
    squarePaymentId: orders.squarePaymentId,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  if (!order.squarePaymentId) {
    return NextResponse.json({ ok: false, error: "Order has no captured Square payment to refund." }, { status: 409 });
  }
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
    return NextResponse.json(
      { ok: false, error: `Only a captured payment can be refunded (payment status is ${order.paymentStatus}).` },
      { status: 409 },
    );
  }

  const refundableCents = order.totalAmount - order.refundedAmountCents;
  if (refundableCents < 1) {
    return NextResponse.json({ ok: false, error: "Order is already fully refunded." }, { status: 409 });
  }
  const amountCents = body.amountCents === undefined ? refundableCents : body.amountCents;
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    return badRequest("amountCents must be a positive whole number of cents.");
  }
  if (amountCents > refundableCents) {
    return badRequest(`amountCents exceeds the ${refundableCents} cents still refundable on this order.`);
  }

  // ── Provider recovery leg (optional) ───────────────────────────────────────
  let providerRecoveryTier: ProviderRecoveryTier | null = null;
  let recoveredAmountCents: number | null = null;
  let providerOutcome: ProviderOutcome = "not_attempted";
  const provider = body.provider;
  if (provider) {
    if (provider.recoveryTier !== undefined) {
      if (!(PROVIDER_RECOVERY_TIER as readonly string[]).includes(provider.recoveryTier)) {
        return badRequest(`provider.recoveryTier must be one of ${PROVIDER_RECOVERY_TIER.join(", ")}.`);
      }
      providerRecoveryTier = provider.recoveryTier as ProviderRecoveryTier;
    }
    if (provider.outcome !== undefined) {
      if (!(PROVIDER_OUTCOMES as readonly string[]).includes(provider.outcome)) {
        return badRequest(`provider.outcome must be one of ${PROVIDER_OUTCOMES.join(", ")}.`);
      }
      providerOutcome = provider.outcome as ProviderOutcome;
    }
    if (provider.productCents !== undefined && !isNonNegativeInteger(provider.productCents)) {
      return badRequest("provider.productCents must be a non-negative whole number of cents.");
    }
    if (provider.shippingCents !== undefined && !isNonNegativeInteger(provider.shippingCents)) {
      return badRequest("provider.shippingCents must be a non-negative whole number of cents.");
    }
    if (provider.recoveredAmountCents !== undefined && !isNonNegativeInteger(provider.recoveredAmountCents)) {
      return badRequest("provider.recoveredAmountCents must be a non-negative whole number of cents.");
    }
    if (providerOutcome !== "not_attempted" && !providerRecoveryTier) {
      return badRequest("provider.recoveryTier is required once the provider cancellation has been attempted.");
    }

    if (providerRecoveryTier && providerOutcome !== "not_attempted") {
      if (provider.recoveredAmountCents !== undefined) {
        // The receipt beats the model.
        recoveredAmountCents = provider.recoveredAmountCents;
      } else if (provider.productCents === undefined && provider.shippingCents === undefined) {
        // Modelling this as 0 would be indistinguishable from "recovered
        // nothing", which is a real and different post_print outcome.
        return badRequest(
          "provider.productCents/shippingCents (or provider.recoveredAmountCents) are required to reconcile the provider leg.",
        );
      } else {
        recoveredAmountCents = calculateProviderRecoveryCents({
          tier: providerRecoveryTier,
          providerProductCents: provider.productCents ?? 0,
          providerShippingCents: provider.shippingCents ?? 0,
        });
      }
    }
  }

  // ── Square ─────────────────────────────────────────────────────────────────
  let issued;
  try {
    issued = await refundSquarePayment({
      paymentId: order.squarePaymentId,
      amountCents,
      currency: order.currency,
      reason,
      idempotencyKey: body.idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square refund failed.";
    // A Square 4xx is a definitive rejection of this request; anything else is
    // an upstream failure whose outcome we cannot claim to know.
    const rejected = /Square API error 4\d\d/.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: rejected ? 409 : 502 });
  }

  // PENDING means Square accepted the refund but the money has not moved. The
  // refund.updated webhook applies the same COMPLETED gate and records it then,
  // so recording it here would book money that may still be REJECTED.
  //
  // That webhook carries no provider fields, so the reconciled provider leg and
  // the operator's reason are PARKED on the pending row keyed by refund id and
  // replayed by readPendingRefundProviderLeg when the refund completes. Without
  // it the ledger would store NULL/NULL — "not reconciled yet" — and the money
  // APLIIQ gave back would never be booked.
  if (!issued.completed) {
    const providerLegParked = await noteOrderRefundPending({
      orderId: order.id,
      squareRefundId: issued.refundId,
      amountCents: issued.amountCents,
      status: issued.status,
      reason,
      actor: "ops",
      providerRecoveryTier,
      recoveredAmountCents,
      providerOutcome,
    }).then(() => true).catch(() => false);
    return NextResponse.json({
      ok: true,
      applied: false,
      refundId: issued.refundId,
      status: issued.status,
      amountCents: issued.amountCents,
      providerRecoveryTier,
      providerOutcome,
      recoveredAmountCents,
      // The refund itself is away at Square either way — this says whether the
      // provider leg survived to be replayed, or has to be re-entered by hand.
      providerLegParked,
      // Named, not described: the recovery instruction has to point at a route
      // that exists, or complying with it achieves nothing.
      ...(providerLegParked ? {} : { reconcilePath: RECONCILE_PATH(issued.refundId) }),
      note: providerLegParked
        ? "Square accepted the refund but has not settled it. The refund webhook records it once it completes."
        : `Square accepted the refund but has not settled it, and the pending note failed to save. The refund webhook will still record the money, but the provider recovery leg will book as NULL. Once it settles, POST the leg to ${RECONCILE_PATH(issued.refundId)}.`,
    }, { status: 202 });
  }

  const outcome = await recordOrderRefund({
    orderId: order.id,
    squarePaymentId: order.squarePaymentId,
    squareRefundId: issued.refundId,
    // Square's number, not ours: it is what the shopper actually gets back.
    amountCents: issued.amountCents,
    currency: issued.currency,
    reason,
    actor: "ops",
    providerRecoveryTier,
    recoveredAmountCents,
    metadata: { providerOutcome, squareRefundStatus: issued.status },
  });

  if (!outcome.applied) {
    // "already_recorded" means the webhook won the race — the refund landed and
    // the order is correct, so this is not a failure.
    const settled = outcome.reason === "already_recorded";
    return NextResponse.json({
      ok: settled,
      applied: false,
      reason: outcome.reason,
      refundId: issued.refundId,
      status: issued.status,
      amountCents: issued.amountCents,
    }, { status: settled ? 200 : 500 });
  }

  return NextResponse.json({
    ok: true,
    applied: true,
    refundId: issued.refundId,
    status: issued.status,
    amountCents: issued.amountCents,
    refundedAmountCents: outcome.refundedAmountCents,
    paymentStatus: outcome.paymentStatus,
    providerRecoveryTier,
    providerOutcome,
    recoveredAmountCents,
  });
}
