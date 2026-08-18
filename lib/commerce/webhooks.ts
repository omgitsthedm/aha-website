// Webhook persistence + dedupe + status reconciliation (§22/§27). Every event is stored raw before
// processing and deduped via webhook_events UNIQUE(provider, dedupe_key). Processing is best-effort
// and idempotent; a webhook never creates fulfillment (that's the paid-order path) — it reconciles.
import { db, isDbConfigured } from "@/lib/db/client";
import {
  webhookEvents, orders, fulfillments, shipments, auditLog, refundAuditLog,
  PROVIDER_RECOVERY_TIER,
  type PaymentStatus, type ProviderRecoveryTier,
} from "@/db/schema";
import { and, desc, eq, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { parseSquareRefund, type SquareRefundObject } from "@/lib/square/refunds";
import { syncOrderFulfillmentStatus } from "./fulfillment";
import { dispatchOrderNotifications, enqueueOrderNotification } from "./notifications";
import { sendOrderShippedPush } from "@/lib/push/webpush";

type Json = Record<string, unknown>;
const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((cur, k) => (cur && typeof cur === "object" ? (cur as Json)[k] : undefined), o);

/** Store + dedupe. Returns isNew=false when this event was already recorded. */
export async function recordWebhookEvent(input: {
  provider: string; eventId?: string | null; eventType?: string | null;
  signatureValid: boolean; rawPayload: unknown; dedupeKey: string;
}): Promise<{
  isNew: boolean;
  eventRecordId: number | null;
  processingStatus: string | null;
}> {
  if (!isDbConfigured()) {
    return { isNew: true, eventRecordId: null, processingStatus: null };
  }
  const inserted = await db().insert(webhookEvents).values({
    provider: input.provider, eventId: input.eventId ?? null, eventType: input.eventType ?? null,
    signatureValid: input.signatureValid, rawPayload: input.rawPayload as Json,
    dedupeKey: input.dedupeKey, processingStatus: "received",
  }).onConflictDoNothing().returning({ id: webhookEvents.id });
  if (inserted[0]) {
    return { isNew: true, eventRecordId: inserted[0].id, processingStatus: "received" };
  }
  const [existing] = await db().select({
    id: webhookEvents.id,
    processingStatus: webhookEvents.processingStatus,
  }).from(webhookEvents).where(and(
    eq(webhookEvents.provider, input.provider),
    eq(webhookEvents.dedupeKey, input.dedupeKey),
  )).limit(1);
  return {
    isNew: false,
    eventRecordId: existing?.id ?? null,
    processingStatus: existing?.processingStatus ?? null,
  };
}

/**
 * Atomically lease a durable event. A redelivery may immediately recover an
 * unclaimed `received` row or a failed attempt; only a genuinely stale active
 * lease can be reclaimed while another invocation may still be running.
 */
export async function claimWebhookEvent(
  eventRecordId: number | null,
  now = new Date(),
  leaseMilliseconds = 5 * 60 * 1000,
): Promise<boolean> {
  if (!eventRecordId || !isDbConfigured()) return false;
  const staleBefore = new Date(now.getTime() - leaseMilliseconds);
  const claimed = await db().update(webhookEvents).set({
    processingStatus: "processing",
    processingStartedAt: now,
    processedAt: null,
    lastError: null,
  }).where(and(
    eq(webhookEvents.id, eventRecordId),
    or(
      eq(webhookEvents.processingStatus, "received"),
      eq(webhookEvents.processingStatus, "failed"),
      and(
        eq(webhookEvents.processingStatus, "processing"),
        or(
          isNull(webhookEvents.processingStartedAt),
          lt(webhookEvents.processingStartedAt, staleBefore),
        ),
      ),
    ),
  )).returning({ id: webhookEvents.id });
  return claimed.length === 1;
}

export async function markWebhookProcessed(eventRecordId: number | null): Promise<void> {
  if (!eventRecordId || !isDbConfigured()) return;
  await db().update(webhookEvents).set({
    processingStatus: "processed", processingStartedAt: null,
    processedAt: new Date(), lastError: null,
  }).where(eq(webhookEvents.id, eventRecordId));
}

export async function markWebhookFailed(eventRecordId: number | null, error: unknown): Promise<void> {
  if (!eventRecordId || !isDbConfigured()) return;
  const message = error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed";
  const [row] = await db().select({ retryCount: webhookEvents.retryCount })
    .from(webhookEvents).where(eq(webhookEvents.id, eventRecordId)).limit(1);
  await db().update(webhookEvents).set({
    processingStatus: "failed", retryCount: (row?.retryCount ?? 0) + 1,
    lastError: message, processingStartedAt: null, processedAt: new Date(),
  }).where(eq(webhookEvents.id, eventRecordId));
}

async function audit(orderId: number, action: string, newStatus: string, meta: Json): Promise<void> {
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action, newStatus, source: "webhook", metadataJson: meta,
  });
}

// ── Refunds ──────────────────────────────────────────────────────────────────
// Shared by the Square refund webhook and the ops-initiated refund action, so
// there is exactly one place that decides what a refund does to an order.

/**
 * The two terminal refund states an order can land in. Declared once so the
 * TypeScript classifier and the SQL CASE in recordOrderRefund can never drift
 * apart on the strings they write.
 */
export const REFUND_ORDER_STATE = {
  full: { paymentStatus: "refunded", customerStatus: "Refunded" },
  partial: { paymentStatus: "partially_refunded", customerStatus: "Partially refunded" },
} as const satisfies Record<"full" | "partial", { paymentStatus: PaymentStatus; customerStatus: string }>;

/**
 * Payment states that mean money has already gone back to the shopper. Derived
 * from REFUND_ORDER_STATE, so a future refund state cannot be added without the
 * payment-confirmation guard in applySquareEvent learning about it.
 */
export const REFUNDED_PAYMENT_STATUSES: PaymentStatus[] = [
  REFUND_ORDER_STATE.full.paymentStatus,
  REFUND_ORDER_STATE.partial.paymentStatus,
];

/**
 * A refund is only "refunded" once the running total reaches the captured
 * total. Anything short of that is partially_refunded — the distinction the
 * previous webhook collapsed, flipping a $5 courtesy refund on a $120 order to
 * fully Refunded.
 */
export function classifyOrderRefund(
  refundedAmountCents: number,
  totalAmountCents: number,
): { paymentStatus: PaymentStatus; customerStatus: string } {
  return refundedAmountCents >= totalAmountCents ? REFUND_ORDER_STATE.full : REFUND_ORDER_STATE.partial;
}

/**
 * APLIIQ's cancellation ladder, in money: how much of what we paid the provider
 * comes back when we cancel at each stage.
 *   pre_garment  — 100% of the provider charge
 *   post_garment — 100% of shipping + 20% of product
 *   post_print   — shipping only
 *
 * ASSUMPTION (decided): the $1.00-per-product fulfillment fee rides with
 * providerProductCents. APLIIQ bills it per product alongside product cost and
 * their published tiers do not carve it out, so it recovers at the product rate.
 *
 * This models what we EXPECT back. When the provider receipt disagrees, store
 * the receipt figure — recordOrderRefund takes recoveredAmountCents directly.
 */
export function calculateProviderRecoveryCents(input: {
  tier: ProviderRecoveryTier;
  providerProductCents: number;
  providerShippingCents: number;
}): number {
  const product = Math.max(0, Math.round(input.providerProductCents));
  const shipping = Math.max(0, Math.round(input.providerShippingCents));
  switch (input.tier) {
    case "pre_garment":
      return product + shipping;
    case "post_garment":
      return shipping + Math.round(product * 0.2);
    case "post_print":
      return shipping;
  }
}

export interface RecordOrderRefundInput {
  /** Square's refund id. UNIQUE in refund_audit_log, so it is the replay guard. */
  squareRefundId: string;
  /** Square's authoritative refunded amount, never our requested amount. */
  amountCents: number;
  reason: string;
  /** "webhook:square", "ops", … — an unattributed refund is not an audit record. */
  actor: string;
  currency?: string;
  /** Preferred lookup. The webhook only carries a payment id, so either works. */
  orderId?: number;
  squarePaymentId?: string;
  providerRecoveryTier?: ProviderRecoveryTier | null;
  /** NULL = provider recovery not reconciled yet; 0 = reconciled, recovered nothing. */
  recoveredAmountCents?: number | null;
  metadata?: Record<string, unknown>;
}

export type RecordOrderRefundResult =
  | {
      applied: true;
      orderId: number;
      /** Projected from the row we read; the stored value is computed in SQL. */
      refundedAmountCents: number;
      paymentStatus: PaymentStatus;
    }
  | {
      applied: false;
      orderId: number | null;
      reason: "db_unavailable" | "invalid_amount" | "order_not_found" | "already_recorded";
    };

/**
 * Record a COMPLETED Square refund and move the order in ONE transaction.
 *
 * Neon's HTTP driver has no interactive transactions (drizzle throws on
 * .transaction()), but db().batch() maps to a single Neon transaction, so the
 * refund ledger row and the order transition commit or roll back together — a
 * refund can never exist without its record, or vice versa.
 *
 * Two layers of idempotency, because a webhook redelivery is normal traffic:
 *  1. a pre-read of refund_audit_log short-circuits a replay, and
 *  2. UNIQUE(square_refund_id) aborts the whole batch if two deliveries race,
 *     which is why the insert deliberately does NOT use onConflictDoNothing.
 *
 * The order's running total is accumulated in SQL off the column itself rather
 * than from the value we read, so two different refunds landing at once cannot
 * lose one another. LEAST() clamps at the captured total.
 */
export async function recordOrderRefund(input: RecordOrderRefundInput): Promise<RecordOrderRefundResult> {
  if (!isDbConfigured()) return { applied: false, orderId: null, reason: "db_unavailable" };
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) {
    return { applied: false, orderId: null, reason: "invalid_amount" };
  }
  const squareRefundId = String(input.squareRefundId ?? "").trim();
  if (!squareRefundId) return { applied: false, orderId: null, reason: "order_not_found" };

  const squarePaymentId = String(input.squarePaymentId ?? "").trim();
  if (!input.orderId && !squarePaymentId) {
    return { applied: false, orderId: null, reason: "order_not_found" };
  }

  const [order] = await db().select({
    id: orders.id,
    totalAmount: orders.totalAmount,
    refundedAmountCents: orders.refundedAmountCents,
    squarePaymentId: orders.squarePaymentId,
  }).from(orders).where(
    input.orderId ? eq(orders.id, input.orderId) : eq(orders.squarePaymentId, squarePaymentId)
  ).limit(1);
  if (!order) return { applied: false, orderId: null, reason: "order_not_found" };

  const [alreadyRecorded] = await db().select({ id: refundAuditLog.id })
    .from(refundAuditLog).where(eq(refundAuditLog.squareRefundId, squareRefundId)).limit(1);
  if (alreadyRecorded) return { applied: false, orderId: order.id, reason: "already_recorded" };

  // Accumulate in SQL, clamped at the captured total, so the stored figure does
  // not depend on the row we just read.
  const nextRefunded = sql`least(${orders.totalAmount}, ${orders.refundedAmountCents} + ${input.amountCents}::int)`;
  const projected = Math.min(order.totalAmount, order.refundedAmountCents + input.amountCents);
  const projectedState = classifyOrderRefund(projected, order.totalAmount);

  await db().batch([
    db().insert(refundAuditLog).values({
      orderId: order.id,
      squarePaymentId: order.squarePaymentId ?? squarePaymentId,
      squareRefundId,
      amountCents: input.amountCents,
      currency: input.currency || "USD",
      reason: input.reason,
      actor: input.actor,
      providerRecoveryTier: input.providerRecoveryTier ?? null,
      recoveredAmountCents: input.recoveredAmountCents ?? null,
    }),
    db().update(orders).set({
      refundedAmountCents: nextRefunded,
      paymentStatus: sql`case when ${nextRefunded} >= ${orders.totalAmount} then ${REFUND_ORDER_STATE.full.paymentStatus}::text else ${REFUND_ORDER_STATE.partial.paymentStatus}::text end`,
      customerStatus: sql`case when ${nextRefunded} >= ${orders.totalAmount} then ${REFUND_ORDER_STATE.full.customerStatus}::text else ${REFUND_ORDER_STATE.partial.customerStatus}::text end`,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id)),
    db().insert(auditLog).values({
      entityType: "order", entityId: String(order.id), action: "refund:recorded",
      newStatus: projectedState.paymentStatus, source: "refund", actor: input.actor,
      metadataJson: {
        ...(input.metadata ?? {}),
        squareRefundId,
        amountCents: input.amountCents,
        priorRefundedAmountCents: order.refundedAmountCents,
        totalAmountCents: order.totalAmount,
        providerRecoveryTier: input.providerRecoveryTier ?? null,
        recoveredAmountCents: input.recoveredAmountCents ?? null,
      },
    }),
  ]);

  return {
    applied: true,
    orderId: order.id,
    refundedAmountCents: projected,
    paymentStatus: projectedState.paymentStatus,
  };
}

/**
 * The audit action a not-yet-settled refund is parked under. Declared once so
 * the writer and the read-back below can never drift on the string.
 */
export const REFUND_PENDING_ACTION = "refund:pending";

export interface NoteOrderRefundPendingInput {
  orderId: number;
  squareRefundId: string;
  amountCents: number;
  status: string;
  reason: string;
  actor: string;
  /** NULL = no provider cancellation reconciled at pending time. */
  providerRecoveryTier?: ProviderRecoveryTier | null;
  /** NULL = provider recovery not reconciled yet; 0 = reconciled, recovered nothing. */
  recoveredAmountCents?: number | null;
  /** "voided" | "refunded" | "not_attempted", as the operator reported it. */
  providerOutcome?: string | null;
}

/**
 * A refund Square accepted but has not settled. No money has moved, so nothing
 * touches refund_audit_log or the order's totals — that stays the exclusive job
 * of the COMPLETED path. This leaves a visible trail so a refund that never
 * settles is not silent.
 *
 * It is also where the provider-recovery leg is PARKED. PENDING -> COMPLETED is
 * the normal card lifecycle (lib/square/refunds.ts), not an edge case, so an ops
 * refund that reconciled an APLIIQ cancellation almost always lands here first.
 * The refund.updated webhook that finally books it carries no provider fields of
 * its own, so without this the ledger stores NULL/NULL — which per db/schema.ts
 * means "provider recovery not reconciled yet", quietly writing off money APLIIQ
 * really did give back, and losing the operator's reason with it.
 */
export async function noteOrderRefundPending(input: NoteOrderRefundPendingInput): Promise<void> {
  if (!isDbConfigured()) return;
  const squareRefundId = String(input.squareRefundId ?? "").trim();
  const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason : null;
  const parked: Json = {
    squareRefundId,
    amountCents: input.amountCents,
    reason,
    // Written unconditionally so a parked row is always readable with the
    // same shape; null here still means "not reconciled", never 0.
    providerRecoveryTier: input.providerRecoveryTier ?? null,
    recoveredAmountCents: input.recoveredAmountCents ?? null,
    providerOutcome: input.providerOutcome ?? null,
  };

  // Re-POSTing with the same idempotencyKey is the documented safe retry, and
  // Square answers it by REPLAYING its stored PENDING response — so this runs a
  // second time for ONE refund. Inserting again parked a second row for the
  // same square refund id and left the read-back to pick between them, which is
  // how a reconciled recovery loses to a NULL. Park in place instead: one
  // refund:pending row per square refund id.
  const [existing] = squareRefundId ? await findParkedRefundRows(squareRefundId, 1) : [];
  if (existing) {
    const previous = (existing.metadataJson ?? {}) as Json;
    await db().update(auditLog).set({
      newStatus: input.status,
      actor: input.actor,
      metadataJson: {
        ...previous,
        ...parked,
        // A retry that omits the provider block must not ERASE a leg an earlier
        // attempt reconciled, so null never overwrites a stored value. 0 does
        // survive: `??` only falls through on null/undefined.
        reason: reason ?? previous.reason ?? null,
        providerRecoveryTier: parked.providerRecoveryTier ?? previous.providerRecoveryTier ?? null,
        recoveredAmountCents: parked.recoveredAmountCents ?? previous.recoveredAmountCents ?? null,
        providerOutcome: parked.providerOutcome ?? previous.providerOutcome ?? null,
      },
    }).where(eq(auditLog.id, existing.id));
    return;
  }

  await db().insert(auditLog).values({
    entityType: "order", entityId: String(input.orderId), action: REFUND_PENDING_ACTION,
    newStatus: input.status, source: "refund", actor: input.actor,
    metadataJson: parked,
  });
}

/** The operator-supplied half of a refund, parked by noteOrderRefundPending. */
export interface PendingRefundProviderLeg {
  /** The operator's words. NULL falls back to Square's own reason. */
  reason: string | null;
  /** Who issued the refund, e.g. "ops" — the webhook only knows it recorded it. */
  actor: string | null;
  providerRecoveryTier: ProviderRecoveryTier | null;
  /** NULL = not reconciled; 0 = reconciled and recovered nothing. Both survive. */
  recoveredAmountCents: number | null;
  providerOutcome: string | null;
}

/** Upper bound on how many parked rows one refund id is reconciled from. */
const PARKED_LEG_SCAN_LIMIT = 20;

/**
 * The refund:pending rows parked against a square refund id, NEWEST FIRST.
 * Shared by the writer and the reader so the two can never drift on which rows
 * belong to a refund. The ORDER BY is load-bearing, not cosmetic: without it
 * Postgres may return the rows in any order at all.
 */
function findParkedRefundRows(squareRefundId: string, limit: number) {
  // Filtered on the action first, so this reads a narrow slice of audit_log.
  return db().select({
    id: auditLog.id,
    actor: auditLog.actor,
    metadataJson: auditLog.metadataJson,
  }).from(auditLog).where(and(
    eq(auditLog.action, REFUND_PENDING_ACTION),
    sql`${auditLog.metadataJson}->>'squareRefundId' = ${squareRefundId}`,
  )).orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(limit);
}

/**
 * Re-validate one parked row into a leg. The metadata is JSONB written by an
 * earlier deploy, so an unknown tier or a non-integer amount degrades to "not
 * reconciled" instead of poisoning the ledger.
 */
function normalizeParkedLeg(row: { actor: string | null; metadataJson: unknown }): PendingRefundProviderLeg {
  const meta = (row.metadataJson ?? {}) as Json;
  const tier = meta.providerRecoveryTier;
  const recovered = meta.recoveredAmountCents;
  const reason = typeof meta.reason === "string" && meta.reason.trim() ? meta.reason : null;
  const outcome = typeof meta.providerOutcome === "string" && meta.providerOutcome ? meta.providerOutcome : null;
  return {
    reason,
    actor: row.actor ?? null,
    providerRecoveryTier:
      typeof tier === "string" && (PROVIDER_RECOVERY_TIER as readonly string[]).includes(tier)
        ? (tier as ProviderRecoveryTier)
        : null,
    // 0 must survive the round trip: it means "reconciled, recovered nothing".
    recoveredAmountCents:
      typeof recovered === "number" && Number.isInteger(recovered) && recovered >= 0 ? recovered : null,
    providerOutcome: outcome,
  };
}

/**
 * A leg that carries the RECEIPT — an actual recovered amount.
 *
 * This deliberately does NOT accept "tier is set". A tier is an intention
 * ("this should be recoverable at the post-garment rate"); the amount is the
 * money. Treating tier-or-amount as reconciled loses real money: with rows
 * {post_garment, 1041} older and {post_garment, null} newer, a newest-first
 * scan picked the newer tier-only row and booked recovered_amount_cents NULL,
 * writing off the $10.41 APLIIQ actually returned. Confirmed by probe
 * 2026-08-17. Requiring the amount makes the receipt win regardless of which
 * row was written last.
 *
 * Note 0 is a real receipt (post-print recovers nothing) and must qualify —
 * hence an explicit null check, never a truthiness test.
 */
function isReconciledLeg(leg: PendingRefundProviderLeg): boolean {
  return leg.recoveredAmountCents !== null;
}

/** A leg carrying an intended tier but no receipt yet. Ranks below a receipt. */
function hasProviderIntent(leg: PendingRefundProviderLeg): boolean {
  return leg.providerRecoveryTier !== null;
}

/**
 * Pure ranking over already-read rows, newest-first on input.
 * Exported as a test seam: the db mock in order-refunds.test.ts evaluates
 * neither WHERE nor ORDER BY, so a test that went through it could not prove
 * this ordering. This can be pinned directly, with no mock at all.
 */
export function __rankParkedLegsForTest(
  legs: PendingRefundProviderLeg[],
): PendingRefundProviderLeg {
  return legs.find(isReconciledLeg) ?? legs.find(hasProviderIntent) ?? legs[0];
}

/**
 * Read back the provider leg parked against a Square refund id. Returns null
 * when nothing was parked (a refund Square originated, or a dashboard refund),
 * which the caller must keep as NULL rather than collapsing to 0.
 *
 * noteOrderRefundPending now parks in place, so the normal case is one row. It
 * is not the only case: rows parked before that fix shipped, and any future
 * concurrent double-park, still leave two. LIMIT 1 with no ORDER BY answered
 * those with whatever Postgres handed back first, so a parked 1041 could lose
 * to a NULL and the money APLIIQ returned was written off. Newest-non-empty
 * wins instead, and it is decided here rather than by the planner.
 */
export async function readPendingRefundProviderLeg(
  squareRefundId: string,
): Promise<PendingRefundProviderLeg | null> {
  if (!isDbConfigured()) return null;
  const refundId = String(squareRefundId ?? "").trim();
  if (!refundId) return null;

  const rows = await findParkedRefundRows(refundId, PARKED_LEG_SCAN_LIMIT);
  if (rows.length === 0) return null;

  const legs = rows.map(normalizeParkedLeg);
  // The winner owns tier + amount + outcome as ONE unit: pairing an amount from
  // one row with a tier from another would invent a reconciliation nobody made.
  // Receipt beats intent beats empty. Before this ordering a newer tier-only row
  // outranked an older row holding the actual recovered amount.
  const winner = __rankParkedLegsForTest(legs);
  // reason and actor are free to fall back, so a later blank note cannot erase
  // the operator's words.
  return {
    ...winner,
    reason: winner.reason ?? legs.find((leg) => leg.reason !== null)?.reason ?? null,
    actor: winner.actor ?? legs.find((leg) => leg.actor !== null)?.actor ?? null,
  };
}

/**
 * The audit action an after-the-fact provider-leg reconciliation writes.
 *
 * refund_audit_log was INSERT-only, so a leg booked as NULL/NULL — the refund
 * settled before the operator had the APLIIQ receipt, or the pending note never
 * saved — was permanently unbookable and the money APLIIQ returned was written
 * off in silence. reconcileRefundProviderLeg below is the only UPDATE path into
 * that table, and this is the trail it leaves.
 */
export const REFUND_RECONCILE_ACTION = "refund:provider-leg-reconciled";

export interface ReconcileRefundProviderLegInput {
  /** The Square refund id of an ALREADY BOOKED refund_audit_log row. */
  squareRefundId: string;
  providerRecoveryTier: ProviderRecoveryTier;
  /** 0 is legal and means "reconciled, recovered nothing". NULL is not: this
   *  route exists to move a leg OFF null, never back onto it. */
  recoveredAmountCents: number;
  /** An ops identity — an unattributed correction is not an audit record. */
  actor: string;
  /** "voided" | "refunded" | "not_attempted", as the operator reported it. */
  providerOutcome?: string | null;
  /** Why. The ops route demands one before it will overwrite a booked figure. */
  note?: string | null;
  /** Changing an already-reconciled non-null requires saying so out loud. */
  allowOverwrite?: boolean;
}

export interface ReconciledProviderLegState {
  providerRecoveryTier: ProviderRecoveryTier | null;
  recoveredAmountCents: number | null;
}

export type ReconcileRefundProviderLegResult =
  | {
      applied: true;
      orderId: number;
      refundAuditLogId: number;
      previous: ReconciledProviderLegState;
      /** What the row ACTUALLY holds now, read back from the UPDATE itself. */
      stored: ReconciledProviderLegState;
      /** False when the ledger moved but its audit row did not. */
      audited: boolean;
    }
  | {
      applied: false;
      reason:
        | "db_unavailable"
        | "invalid_input"
        | "refund_not_found"
        /** Already holds exactly these values — a retry, not a failure. */
        | "unchanged"
        /** Already reconciled to something else; needs allowOverwrite. */
        | "already_reconciled"
        /** Another reconciliation moved the row between the read and the write. */
        | "raced";
      orderId: number | null;
      current: ReconciledProviderLegState | null;
    };

/**
 * Book the provider recovery leg onto a refund that was already recorded.
 *
 * Deliberately narrow: it moves provider_recovery_tier and
 * recovered_amount_cents and nothing else. It never touches the refunded
 * amount, the payment status or the shopper's money — those stay owned by
 * recordOrderRefund.
 *
 * Safety properties, in the order they are enforced below:
 *  1. idempotent — re-sending the same pair is a no-op success, so an ops retry
 *     is free;
 *  2. never a silent overwrite — a leg already reconciled to a DIFFERENT value
 *     is refused unless the caller passes allowOverwrite, and the override is
 *     audited with the value it replaced;
 *  3. the UPDATE is pinned to the state that was read, so a reconciliation
 *     racing this one is refused rather than clobbered; and
 *  4. the answer is read back out of RETURNING, so the caller is told what the
 *     ledger holds and not what it was asked for.
 */
export async function reconcileRefundProviderLeg(
  input: ReconcileRefundProviderLegInput,
): Promise<ReconcileRefundProviderLegResult> {
  if (!isDbConfigured()) return { applied: false, reason: "db_unavailable", orderId: null, current: null };

  const squareRefundId = String(input.squareRefundId ?? "").trim();
  const actor = String(input.actor ?? "").trim();
  const tier = input.providerRecoveryTier;
  const recovered = input.recoveredAmountCents;
  if (
    !squareRefundId || !actor ||
    !(PROVIDER_RECOVERY_TIER as readonly string[]).includes(tier) ||
    typeof recovered !== "number" || !Number.isInteger(recovered) || recovered < 0
  ) {
    return { applied: false, reason: "invalid_input", orderId: null, current: null };
  }

  const [row] = await db().select({
    id: refundAuditLog.id,
    orderId: refundAuditLog.orderId,
    providerRecoveryTier: refundAuditLog.providerRecoveryTier,
    recoveredAmountCents: refundAuditLog.recoveredAmountCents,
  }).from(refundAuditLog).where(eq(refundAuditLog.squareRefundId, squareRefundId)).limit(1);
  // No booked refund means there is nothing to reconcile YET — a pending refund
  // still parks its leg through noteOrderRefundPending.
  if (!row) return { applied: false, reason: "refund_not_found", orderId: null, current: null };

  const previous: ReconciledProviderLegState = {
    providerRecoveryTier: row.providerRecoveryTier ?? null,
    recoveredAmountCents: row.recoveredAmountCents ?? null,
  };
  if (previous.providerRecoveryTier === tier && previous.recoveredAmountCents === recovered) {
    return { applied: false, reason: "unchanged", orderId: row.orderId, current: previous };
  }
  const alreadyReconciled =
    previous.providerRecoveryTier !== null || previous.recoveredAmountCents !== null;
  if (alreadyReconciled && !input.allowOverwrite) {
    return { applied: false, reason: "already_reconciled", orderId: row.orderId, current: previous };
  }

  const updated = await db().update(refundAuditLog).set({
    providerRecoveryTier: tier,
    recoveredAmountCents: recovered,
  }).where(and(
    eq(refundAuditLog.id, row.id),
    previous.providerRecoveryTier === null
      ? isNull(refundAuditLog.providerRecoveryTier)
      : eq(refundAuditLog.providerRecoveryTier, previous.providerRecoveryTier),
    previous.recoveredAmountCents === null
      ? isNull(refundAuditLog.recoveredAmountCents)
      : eq(refundAuditLog.recoveredAmountCents, previous.recoveredAmountCents),
  )).returning({
    id: refundAuditLog.id,
    providerRecoveryTier: refundAuditLog.providerRecoveryTier,
    recoveredAmountCents: refundAuditLog.recoveredAmountCents,
  });
  if (!updated[0]) return { applied: false, reason: "raced", orderId: row.orderId, current: previous };

  // The ledger already carries the corrected money. A trail failure cannot
  // un-say that, so it is reported instead of thrown.
  let audited = true;
  try {
    await db().insert(auditLog).values({
      entityType: "order", entityId: String(row.orderId), action: REFUND_RECONCILE_ACTION,
      newStatus: "reconciled", source: "refund", actor,
      metadataJson: {
        squareRefundId,
        providerRecoveryTier: tier,
        recoveredAmountCents: recovered,
        previousProviderRecoveryTier: previous.providerRecoveryTier,
        previousRecoveredAmountCents: previous.recoveredAmountCents,
        overwroteReconciledLeg: alreadyReconciled,
        providerOutcome: input.providerOutcome ?? null,
        note: input.note ?? null,
      },
    });
  } catch {
    audited = false;
  }

  return {
    applied: true,
    orderId: row.orderId,
    refundAuditLogId: updated[0].id,
    previous,
    stored: {
      providerRecoveryTier: updated[0].providerRecoveryTier ?? null,
      recoveredAmountCents: updated[0].recoveredAmountCents ?? null,
    },
    audited,
  };
}

/** Square: reconcile payment + refund status. */
export async function applySquareEvent(event: unknown): Promise<void> {
  if (!isDbConfigured()) return;
  const type = String(get(event, "type") || "");
  if (type.startsWith("payment.")) {
    const status = get(event, "data", "object", "payment", "status");
    const squareOrderId = String(get(event, "data", "object", "payment", "order_id") || "");
    if (status === "COMPLETED" && squareOrderId) {
      // A refunded Square payment KEEPS status COMPLETED — the refund is a
      // separate object — and any later payment.* delivery for the same order
      // is a distinct event id, so the route's dedupe passes it through. Writing
      // "paid" unconditionally therefore walked a refunded order back to
      // "Payment confirmed" while refunded_amount_cents stayed > 0, leaving the
      // two columns in silent disagreement until the next refund happened to
      // re-run classifyOrderRefund. Refund state is owned by recordOrderRefund;
      // this branch may only confirm an order that has not been refunded.
      const rows = await db().update(orders)
        .set({ paymentStatus: "paid", customerStatus: "Payment confirmed", updatedAt: new Date() })
        .where(and(
          eq(orders.squareOrderId, squareOrderId),
          notInArray(orders.paymentStatus, REFUNDED_PAYMENT_STATUSES),
        )).returning({ id: orders.id });
      if (rows[0]) await audit(rows[0].id, "webhook:payment", "paid", { squareOrderId });
    }
  } else if (type.startsWith("refund.")) {
    // Gate on the refund's own status and amount. The previous version read
    // neither: a PENDING refund.created, a REJECTED/FAILED refund and a partial
    // refund all flipped the whole order to Refunded.
    const refund = parseSquareRefund(get(event, "data", "object", "refund") as SquareRefundObject | undefined);
    if (!refund || !refund.completed) return;
    // Most refunds that settle here were issued by ops minutes earlier and came
    // back PENDING, so the tier, the recovered amount and the operator's reason
    // are parked on the refund:pending row. Replay them; a lookup failure must
    // not block the money, it just leaves the provider leg unreconciled.
    const parked = await readPendingRefundProviderLeg(refund.refundId).catch(() => null);
    await recordOrderRefund({
      squarePaymentId: refund.paymentId,
      squareRefundId: refund.refundId,
      amountCents: refund.amountCents,
      currency: refund.currency,
      // The operator's words beat Square's generic reason.
      reason: parked?.reason || refund.reason || type,
      actor: "webhook:square",
      // A Square webhook reconciles no provider leg of its own: with nothing
      // parked these stay NULL ("not reconciled yet"), never 0.
      providerRecoveryTier: parked?.providerRecoveryTier ?? null,
      recoveredAmountCents: parked?.recoveredAmountCents ?? null,
      metadata: {
        squareEventType: type,
        ...(parked
          ? {
              providerOutcome: parked.providerOutcome,
              refundInitiatedBy: parked.actor,
              providerLegSource: REFUND_PENDING_ACTION,
            }
          : {}),
      },
    });
  }
}

/** Printful: reconcile fulfillment + shipment status; record catalog signals. */
export async function applyPrintfulEvent(event: unknown): Promise<void> {
  if (!isDbConfigured()) return;
  const type = String(get(event, "type") || "");

  // Catalog signals (v2 webhooks): blank prices and stock move under us in
  // real time. The raw payload is already stored in webhook_events; an audit
  // row makes them visible on /ops and greppable for the margin/liveness rails.
  if (type === "catalog_price_changed" || type === "catalog_stock_updated") {
    await db().insert(auditLog).values({
      entityType: "provider", entityId: "printful",
      action: `webhook:${type}`, newStatus: type === "catalog_price_changed" ? "price_changed" : "stock_updated",
      source: "webhook", metadataJson: (get(event, "data") ?? {}) as Record<string, unknown>,
    });
    return;
  }

  const printfulOrderId = String(
    get(event, "data", "order", "id") ?? get(event, "data", "shipment", "order_id") ?? ""
  );
  if (!printfulOrderId) return;
  const [providerFulfillment] = await db().select({
    id: fulfillments.id, orderId: fulfillments.orderId,
  }).from(fulfillments).where(eq(fulfillments.printfulOrderId, printfulOrderId)).limit(1);
  let orderId = providerFulfillment?.orderId ?? null;
  if (!orderId) {
    // Backward compatibility for orders created before per-store fulfillment rows existed.
    const [legacyOrder] = await db().select({ id: orders.id })
      .from(orders).where(eq(orders.printfulOrderId, printfulOrderId)).limit(1);
    orderId = legacyOrder?.id ?? null;
  }
  if (!orderId) return;

  if (type === "package_shipped" || type === "shipment_sent") {
    const ship = get(event, "data", "shipment") as Json | undefined;
    if (providerFulfillment) {
      await db().update(fulfillments).set({ status: "shipped", lastError: null, updatedAt: new Date() })
        .where(eq(fulfillments.id, providerFulfillment.id));
    }
    await db().insert(shipments).values({
      orderId, printfulShipmentId: String(ship?.id ?? ""),
      carrier: String(ship?.carrier ?? "") || null, trackingNumber: String(ship?.tracking_number ?? "") || null,
      trackingUrl: String(ship?.tracking_url ?? "") || null, status: "shipped", shippedAt: new Date(),
      dataJson: ship ?? null,
    });
    const status = providerFulfillment ? await syncOrderFulfillmentStatus(orderId) : "shipped";
    if (!providerFulfillment) {
      await db().update(orders).set({ fulfillmentStatus: status, customerStatus: "Shipped", updatedAt: new Date() })
        .where(eq(orders.id, orderId));
    }
    await audit(orderId, "webhook:shipped", status, { printfulOrderId });
    await enqueueOrderNotification(orderId, "order_shipped", {
      shipmentId: String(ship?.id ?? ""), trackingUrl: String(ship?.tracking_url ?? ""),
      carrier: String(ship?.carrier ?? ""), trackingNumber: String(ship?.tracking_number ?? ""),
    });
    await dispatchOrderNotifications(5, orderId).catch(() => {});
    try {
      const [o] = await db().select({ orderNumber: orders.externalOrderNumber })
        .from(orders).where(eq(orders.id, orderId)).limit(1);
      if (o) {
        await sendOrderShippedPush(orderId, {
          orderNumber: o.orderNumber,
          trackingUrl: String(ship?.tracking_url ?? "") || undefined,
        });
      }
    } catch {
      // Push is best-effort; the shipped email is the guaranteed channel.
    }
  } else if (type === "order_failed" || type === "order_put_hold") {
    if (providerFulfillment) {
      await db().update(fulfillments).set({ status: "manual_review", lastError: type, updatedAt: new Date() })
        .where(eq(fulfillments.id, providerFulfillment.id));
      await syncOrderFulfillmentStatus(orderId);
    } else {
      await db().update(orders).set({ fulfillmentStatus: "manual_review", updatedAt: new Date() }).where(eq(orders.id, orderId));
    }
    await audit(orderId, "webhook:hold", "manual_review", { type, printfulOrderId });
    await enqueueOrderNotification(orderId, "fulfillment_attention", { reason: type });
    await dispatchOrderNotifications(5, orderId).catch(() => {});
  } else if (type === "order_canceled") {
    if (providerFulfillment) {
      await db().update(fulfillments).set({ status: "canceled", lastError: null, updatedAt: new Date() })
        .where(eq(fulfillments.id, providerFulfillment.id));
      await syncOrderFulfillmentStatus(orderId);
    } else {
      await db().update(orders).set({ fulfillmentStatus: "canceled", customerStatus: "Canceled", updatedAt: new Date() }).where(eq(orders.id, orderId));
    }
    await audit(orderId, "webhook:canceled", "canceled", { printfulOrderId });
  }
}
