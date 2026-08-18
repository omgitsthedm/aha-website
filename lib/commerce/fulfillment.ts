// Fulfillment engine (§25). Runs only after Square payment succeeds. Each provider batch gets its
// own durable fulfillment row so retries and webhooks can reconcile provider orders independently.
// Printful confirmation remains gated by both explicit production flags; APLIIQ order submission
// has its own server-only live gate in the provider adapter.
import { printfulRequest } from "@/lib/printful/client";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, fulfillments, auditLog } from "@/db/schema";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { ApliiqHttpError } from "@/lib/apliiq/client";
import { getApliiqOrder, listApliiqOrders } from "@/lib/apliiq/orders";
import type { ApliiqClient, ApliiqOrderRecord } from "@/lib/apliiq/types";
import type { RevalidatedCart, OrderContact } from "./orders";
import {
  createLiveApliiqClient,
  getApliiqSubmissionBlockReason,
  isApliiqSubmissionAllowed,
  submitApliiqFulfillment,
} from "@/lib/fulfillment/apliiq-adapter";
import { groupItemsByFulfillmentProvider } from "@/lib/fulfillment/provider-dispatcher";
import {
  aggregateFulfillmentStatus, buildStoreOrderRequest, customerStatusFor, groupSourceItemsByPrintfulStore,
  isPrintfulConfirmationAllowed, shouldRetryPrintfulConfirmation,
} from "./fulfillment-state";
import { dispatchOrderNotifications, enqueueOrderNotification } from "./notifications";

function confirmAllowed(): boolean {
  return isPrintfulConfirmationAllowed({
    fulfillmentMode: process.env.AHA_FULFILLMENT_MODE,
    allowConfirm: process.env.PRINTFUL_ALLOW_CONFIRM_ORDERS,
    liveMode: process.env.PRINTFUL_LIVE_MODE,
  });
}

interface PrintfulOrderResponse { data?: { id?: number | string }; result?: { id?: number | string }; id?: number | string }

export async function syncOrderFulfillmentStatus(orderId: number): Promise<string> {
  const rows = await db().select({ status: fulfillments.status })
    .from(fulfillments).where(eq(fulfillments.orderId, orderId));
  const status = aggregateFulfillmentStatus(rows.map((row) => row.status));
  await db().update(orders)
    .set({ fulfillmentStatus: status, customerStatus: customerStatusFor(status), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  return status;
}

async function markManualReview(orderId: number, reason: string): Promise<void> {
  await db().update(orders)
    .set({ fulfillmentStatus: "manual_review", customerStatus: "Action needed", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action: "fulfillment:manual_review",
    newStatus: "manual_review", source: "fulfillment", metadataJson: { reason },
  });
  await enqueueOrderNotification(orderId, "fulfillment_attention", { reason });
  await dispatchOrderNotifications(5, orderId).catch(() => {});
}

async function confirmPrintfulOrder(orderId: number, fulfillmentId: number, printfulOrderId: string, storeId: number): Promise<void> {
  try {
    // v1 confirm — order ids share one space across API versions, and v1 is the
    // only version that can confirm sync-fulfilled orders (v2 dropped sync 2026-07).
    await printfulRequest(`/orders/${printfulOrderId}/confirm`, { method: "POST", storeId: String(storeId), apiVersion: "v1" });
    await db().update(fulfillments).set({ status: "confirmed", lastError: null, updatedAt: new Date() })
      .where(eq(fulfillments.id, fulfillmentId));
    await db().insert(auditLog).values({
      entityType: "order", entityId: String(orderId), action: "fulfillment:confirmed",
      newStatus: "confirmed", source: "fulfillment", metadataJson: { printfulOrderId, storeId, confirmAllowed: true },
    });
    await enqueueOrderNotification(orderId, "order_in_production");
    await dispatchOrderNotifications(5, orderId).catch(() => {});
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Printful confirmation failed";
    await db().update(fulfillments).set({ status: "confirmation_failed", lastError: message, updatedAt: new Date() })
      .where(eq(fulfillments.id, fulfillmentId));
    await markManualReview(orderId, message);
    throw error;
  }
}

async function auditApliiqFulfillment(
  orderId: number,
  action: string,
  newStatus: string,
  metadata: Record<string, unknown>,
  oldStatus?: string
): Promise<void> {
  await db().insert(auditLog).values({
    entityType: "order",
    entityId: String(orderId),
    action,
    ...(oldStatus ? { oldStatus } : {}),
    newStatus,
    source: "fulfillment",
    metadataJson: { provider: "apliiq", ...metadata },
  });
}

async function transitionApliiqFulfillment(input: {
  orderId: number;
  fulfillmentId: number;
  oldStatus: string;
  status: string;
  action: string;
  reason?: string | null;
  providerOrderId?: string;
  providerData?: Record<string, unknown>;
  providerRequestId?: string;
}): Promise<void> {
  await db().update(fulfillments).set({
    status: input.status,
    ...(input.reason === undefined ? {} : { lastError: input.reason }),
    ...(input.providerOrderId ? { providerOrderId: input.providerOrderId } : {}),
    ...(input.providerData ? { providerDataJson: input.providerData } : {}),
    updatedAt: new Date(),
  }).where(eq(fulfillments.id, input.fulfillmentId));
  await auditApliiqFulfillment(input.orderId, input.action, input.status, {
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.providerOrderId ? { providerOrderId: input.providerOrderId } : {}),
    ...(input.providerRequestId ? { providerRequestId: input.providerRequestId } : {}),
  }, input.oldStatus);
}

/** One APLIIQ batch per AHA order; the unique (order, claim key) row is the claim. */
const APLIIQ_CLAIM_KEY = "apliiq:default";

/**
 * Deterministic, order-scoped provider request identity. Being a pure function
 * of the AHA order id is load-bearing: a release or resubmission re-derives the
 * byte-identical value APLIIQ would have seen on the first attempt, so the
 * unique (provider, providerRequestId) index still blocks a second row and the
 * provider still sees one `id`.
 */
function apliiqProviderRequestId(orderId: number): string {
  return `aha-apliiq-${orderId}`;
}

// ── Ops hold release: deliberate, per-order, one shot ────────────────────────
// A gate-held order must be RELEASABLE without database surgery, and releasing
// it must be a per-order human act rather than a side effect of flipping
// APLIIQ_LIVE_MODE. Those two properties are held apart by this marker:
//
//   - Only forceResubmitApliiqFulfillment writes one, one row at a time, from
//     the ops break-glass endpoint.
//   - The automatic callers (create-payment and the */15 reconcile cron) can
//     only CONSUME one. They never write one, so opening the gates on a backlog
//     of N held orders submits nothing at all.
//
// It lives in the row's existing providerDataJson: no migration, and the
// authorization travels with the exact claim it authorizes rather than sitting
// in a process-wide env rail that would release the whole backlog at once.
const APLIIQ_HOLD_RELEASE_KEY = "apliiqHoldRelease";

/**
 * An authorization is consumed by the next submission attempt and expires on its
 * own, so one that was written and then never used (the ops route's follow-up
 * retry threw, say) cannot sit on the row waiting for an unattended cron pass
 * days later. Re-authorizing is one more click; auto-submitting is money.
 */
export const APLIIQ_HOLD_RELEASE_TTL_MS = 30 * 60 * 1000;

export interface ApliiqHoldReleaseAuthorization {
  authorizedAt: string;
  authorizedBy: string;
  /** Why the release is safe. Both bases mean APLIIQ does not hold this order. */
  basis: "never_submitted" | "absence_proven";
  /** Row status at the moment of authorization, for the audit trail. */
  releasedFrom: string;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : null;
}

function apliiqHoldReleaseAuthorization(
  basis: ApliiqHoldReleaseAuthorization["basis"],
  releasedFrom: string
): ApliiqHoldReleaseAuthorization {
  return { authorizedAt: new Date().toISOString(), authorizedBy: "ops:apliiq-force-resubmit", basis, releasedFrom };
}

function withApliiqHoldRelease(
  providerData: unknown,
  authorization: ApliiqHoldReleaseAuthorization
): Record<string, unknown> {
  return { ...(jsonRecord(providerData) ?? {}), [APLIIQ_HOLD_RELEASE_KEY]: authorization };
}

/** Consuming the authorization removes it, which is what makes it one-shot. */
function withoutApliiqHoldRelease(providerData: unknown): Record<string, unknown> | null {
  const record = jsonRecord(providerData);
  if (!record) return null;
  delete record[APLIIQ_HOLD_RELEASE_KEY];
  return Object.keys(record).length > 0 ? record : null;
}

/**
 * The same requirement expressed in the UPDATE itself, so the release cannot
 * fire against a row that carries no authorization even if the TypeScript guard
 * above it were ever refactored away.
 */
function apliiqHoldReleaseAuthorizedSql(): SQL {
  return sql`${fulfillments.providerDataJson} -> ${sql.raw(`'${APLIIQ_HOLD_RELEASE_KEY}'`)} is not null`;
}

/** A live, well-formed, unexpired authorization, or null. Never throws. */
function readApliiqHoldRelease(providerData: unknown, now = Date.now()): ApliiqHoldReleaseAuthorization | null {
  const marker = jsonRecord(jsonRecord(providerData)?.[APLIIQ_HOLD_RELEASE_KEY]);
  if (!marker) return null;
  const authorizedAt = typeof marker.authorizedAt === "string" ? Date.parse(marker.authorizedAt) : Number.NaN;
  if (!Number.isFinite(authorizedAt)) return null;
  // Expired, or dated into the future by a skewed clock: both refuse rather than
  // widen the window an operator thought they were opening.
  if (now - authorizedAt > APLIIQ_HOLD_RELEASE_TTL_MS || authorizedAt - now > 60_000) return null;
  return {
    authorizedAt: marker.authorizedAt as string,
    authorizedBy: typeof marker.authorizedBy === "string" ? marker.authorizedBy : "unknown",
    basis: marker.basis === "absence_proven" ? "absence_proven" : "never_submitted",
    releasedFrom: typeof marker.releasedFrom === "string" ? marker.releasedFrom : "unknown",
  };
}

async function holdApliiqFulfillment(
  orderId: number,
  providerReference: string,
  reason: string
): Promise<void> {
  const held = await db().insert(fulfillments).values({
    orderId,
    fulfillmentProvider: "apliiq",
    providerClaimKey: APLIIQ_CLAIM_KEY,
    providerReference,
    status: "manual_review",
    lastError: reason.slice(0, 500),
  }).onConflictDoNothing().returning({ id: fulfillments.id });
  if (held[0]) {
    await auditApliiqFulfillment(orderId, "fulfillment:apliiq_claimed_manual", "manual_review", {
      providerReference,
      reason: reason.slice(0, 500),
    }, "not_started");
  }
  await markManualReview(orderId, reason);
}

/**
 * APLIIQ has no safe POST retry guarantee. The row, request identity, and
 * customer-visible AHA reference are therefore persisted in the initial
 * insert, before its only remote create-order call.
 *
 * That write ordering is what makes `providerRequestId` a decision column:
 *   - NULL  -> holdApliiqFulfillment created this row and returned before any
 *              POST existed in the code path. No create request was ever
 *              issued, so releasing and submitting it cannot duplicate.
 *   - set   -> a create POST was issued for this row and its outcome is
 *              unknown. It stays terminal here and only the ops force-resubmit
 *              path, which first proves absence at the provider, can release it.
 *
 * NULL makes a release SAFE; it does not make it AUTHORIZED. This function is
 * reached by create-payment and by the 15-minute reconcile cron as well as by
 * ops, so releasing on NULL alone would mean that the moment APLIIQ_ALLOW_CREATE_ORDERS
 * flips, every held order in the backlog submits unattended — an env-var edit
 * spending real money at APLIIQ's processing-time charge. A held row therefore
 * also needs a live per-order ops authorization in providerDataJson, which only
 * forceResubmitApliiqFulfillment writes. Without one this path is inert: it
 * writes nothing and submits nothing.
 */
async function startApliiqFulfillment(
  orderId: number,
  items: RevalidatedCart["items"],
  contact: OrderContact
): Promise<void> {
  const [order] = await db().select({
    externalOrderNumber: orders.externalOrderNumber,
    paymentStatus: orders.paymentStatus,
    squarePaymentId: orders.squarePaymentId,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.paymentStatus !== "paid") {
    throw new Error("Only paid orders can enter APLIIQ fulfillment.");
  }
  if (!order.squarePaymentId) {
    await holdApliiqFulfillment(orderId, order.externalOrderNumber, "APLIIQ fulfillment requires a persisted Square payment id.");
    return;
  }

  const blocked = getApliiqSubmissionBlockReason();
  if (!isApliiqSubmissionAllowed() || blocked) {
    // Record the hold as a provider row so the final aggregate cannot erase
    // the manual-attention state when this order contains only APLIIQ lines.
    await holdApliiqFulfillment(orderId, order.externalOrderNumber, blocked ?? "APLIIQ order submission is disabled by server-side production gates.");
    return;
  }

  const providerRequestId = apliiqProviderRequestId(orderId);
  const [existing] = await db().select({
    id: fulfillments.id,
    providerRequestId: fulfillments.providerRequestId,
    providerOrderId: fulfillments.providerOrderId,
    providerDataJson: fulfillments.providerDataJson,
    status: fulfillments.status,
  }).from(fulfillments).where(and(
    eq(fulfillments.orderId, orderId),
    eq(fulfillments.providerClaimKey, APLIIQ_CLAIM_KEY)
  )).limit(1);

  // Already living at APLIIQ: webhooks own it from here.
  if (existing?.providerOrderId) return;

  let fulfillmentId: number;

  if (existing && existing.providerRequestId) {
    const reason = `APLIIQ request ${existing.providerRequestId} already has a durable claim (${existing.status}); it will not be submitted again automatically.`;
    await transitionApliiqFulfillment({
      orderId,
      fulfillmentId: existing.id,
      oldStatus: existing.status,
      status: "manual_review",
      action: "fulfillment:apliiq_manual_reconciliation_required",
      reason,
      providerRequestId: existing.providerRequestId,
    });
    await markManualReview(orderId, reason);
    return;
  }

  if (existing) {
    // Gate hold, or a hold taken before the Square payment id landed. No
    // providerRequestId means no create POST was ever issued for this row, so
    // submitting it cannot duplicate — but "cannot duplicate" is not "go".
    const authorization = readApliiqHoldRelease(existing.providerDataJson);
    if (!authorization) {
      // Inert on purpose. No submission, no write, no audit noise: a backlog of
      // held orders stays exactly as it is when the gates open, and each one
      // ships only when an operator releases that specific order through
      // forceResubmitApliiqFulfillment. The row keeps its manual_review status
      // and its original hold reason, so the ops queue still shows it.
      return;
    }

    const reclaimed = await db().update(fulfillments).set({
      providerRequestId,
      providerReference: order.externalOrderNumber,
      // Consume the authorization in the same statement that claims the row:
      // one release buys exactly one submission.
      providerDataJson: withoutApliiqHoldRelease(existing.providerDataJson),
      status: "draft_creating",
      lastError: null,
      updatedAt: new Date(),
    }).where(and(
      eq(fulfillments.id, existing.id),
      // The NULL -> id flip is the cross-request claim, exactly like the insert
      // below. Whichever request wins submits; the loser matches no row and
      // returns rather than issuing a second POST.
      isNull(fulfillments.providerRequestId),
      isNull(fulfillments.providerOrderId),
      apliiqHoldReleaseAuthorizedSql(),
    )).returning({ id: fulfillments.id });
    if (!reclaimed[0]) return;
    fulfillmentId = reclaimed[0].id;
    await auditApliiqFulfillment(orderId, "fulfillment:apliiq_hold_released", "draft_creating", {
      providerReference: order.externalOrderNumber,
      providerRequestId,
      releasedFrom: existing.status,
      authorization,
    }, existing.status);
  } else {
    const claimed = await db().insert(fulfillments).values({
      orderId,
      fulfillmentProvider: "apliiq",
      providerClaimKey: APLIIQ_CLAIM_KEY,
      providerReference: order.externalOrderNumber,
      providerRequestId,
      status: "draft_creating",
    }).onConflictDoNothing().returning({ id: fulfillments.id });

    // The unique (order, providerClaimKey) row is the cross-request claim. Do
    // not assume the losing request knows whether the winner reached APLIIQ.
    if (!claimed[0]) return;
    fulfillmentId = claimed[0].id;
    await auditApliiqFulfillment(orderId, "fulfillment:apliiq_claimed", "draft_creating", {
      providerReference: order.externalOrderNumber,
      providerRequestId,
    }, "not_started");
  }

  try {
    const submission = await submitApliiqFulfillment(createLiveApliiqClient(), {
      orderId,
      externalOrderNumber: order.externalOrderNumber,
      providerRequestId,
      contact,
      items,
    });
    if (submission.outcome === "accepted") {
      await transitionApliiqFulfillment({
        orderId,
        fulfillmentId,
        oldStatus: "draft_creating",
        status: "manual_review",
        action: "fulfillment:apliiq_accepted_manual_review",
        reason: submission.attentionReason.slice(0, 500),
        providerData: { outcome: "accepted" },
        providerRequestId,
      });
      await markManualReview(orderId, submission.attentionReason);
      return;
    }

    await transitionApliiqFulfillment({
      orderId,
      fulfillmentId,
      oldStatus: "draft_creating",
      status: "draft_created",
      action: "fulfillment:apliiq_submitted",
      reason: null,
      providerOrderId: submission.providerOrderId,
      providerData: { outcome: "processed" },
      providerRequestId,
    });
  } catch (error) {
    // A timeout or transport error can still mean that APLIIQ accepted the
    // request. Retain the request id and require a provider-side lookup.
    const message = error instanceof Error ? error.message.slice(0, 500) : "APLIIQ order submission outcome is unknown";
    await transitionApliiqFulfillment({
      orderId,
      fulfillmentId,
      oldStatus: "draft_creating",
      status: "manual_review",
      action: "fulfillment:apliiq_submission_outcome_unknown",
      reason: message,
      providerRequestId,
    });
    await markManualReview(orderId, message);
    throw error;
  }
}

// ── Ops force resubmit (APLIIQ order the provider never received) ────────────

export interface ApliiqAbsenceEvidence {
  checkedAt: string;
  /** Every provider read performed, in order, for the ops audit trail. */
  lookups: string[];
  recordsScanned: number;
  /** Set when no provider read was needed, stating what stands in for one. */
  basis?: string;
}

export type ApliiqForceResubmitResult =
  | {
      outcome: "released";
      /**
       * Which release this was. `hold_authorized` never issued a create POST, so
       * there was nothing to prove absent; `absence_proven` did, and the
       * provider reads in `evidence` are what permitted it.
       */
      release: "hold_authorized" | "absence_proven";
      providerRequestId: string;
      evidence: ApliiqAbsenceEvidence;
    }
  | { outcome: "blocked"; reason: string; providerOrderId?: string };

function apliiqRecordIdentities(record: ApliiqOrderRecord): string[] {
  return [record.StoreSystemOrderId, record.StoreOrderId, record.OrderId]
    .map((value) => (value === undefined || value === null ? "" : String(value).trim().toUpperCase()))
    .filter((value) => value.length > 0);
}

function providerOrderIdValue(value: string | number | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

async function readApliiqOrdersById(
  client: ApliiqClient,
  id: string
): Promise<{ records: ApliiqOrderRecord[]; lookup: string }> {
  try {
    return { records: await getApliiqOrder(client, id), lookup: `GET /Order/${id}` };
  } catch (error) {
    // A 404 is the provider positively answering "no such order", which is
    // evidence of absence. Every other status (401/403/429/5xx) and every
    // transport error leaves absence UNPROVEN, so it propagates and the
    // resubmission is refused rather than guessed at.
    if (error instanceof ApliiqHttpError && error.status === 404) {
      return { records: [], lookup: `GET /Order/${id} -> 404` };
    }
    throw error;
  }
}

/**
 * Positively establish that APLIIQ does not hold this order. Throws when any
 * required read fails: an unproven absence must never look like an absence.
 */
async function proveApliiqOrderAbsent(
  client: ApliiqClient,
  params: { providerRequestId: string; externalOrderNumber: string }
): Promise<
  | { absent: true; evidence: ApliiqAbsenceEvidence }
  | { absent: false; record: ApliiqOrderRecord; evidence: ApliiqAbsenceEvidence }
> {
  const needles = [params.providerRequestId, params.externalOrderNumber].map((value) => value.trim().toUpperCase());
  const lookups: string[] = [];
  const records: ApliiqOrderRecord[] = [];

  for (const id of [params.providerRequestId, params.externalOrderNumber]) {
    const read = await readApliiqOrdersById(client, id);
    lookups.push(read.lookup);
    records.push(...read.records);
  }

  // The id lookups above answer on APLIIQ's own OrderId, which we never learn
  // for an order we are not sure they received, so the listing is what actually
  // covers our store-system id. Both windows must succeed: the default recent
  // window, plus an explicit wide one because a break-glass resubmission can
  // happen long after checkout. The provider's `yearOrlastNoMonth` parameter is
  // documented ambiguously (calendar year OR last-N-months); passing the current
  // year returns a superset under either reading, which is what an absence
  // proof needs.
  for (const listWindow of [undefined, new Date().getUTCFullYear()]) {
    const listed = await listApliiqOrders(client, listWindow);
    lookups.push(listWindow === undefined ? "GET /Order" : `GET /Order?yearOrlastNoMonth=${listWindow}`);
    records.push(...listed);
  }

  const evidence: ApliiqAbsenceEvidence = {
    checkedAt: new Date().toISOString(),
    lookups,
    recordsScanned: records.length,
  };
  const found = records.find((record) => apliiqRecordIdentities(record).some((identity) => needles.includes(identity)));
  return found ? { absent: false, record: found, evidence } : { absent: true, evidence };
}

/**
 * Ops-only break-glass release for an APLIIQ order the provider never received.
 * It does not submit; it authorizes the ordinary retry path to submit this ONE
 * order once, re-deriving the SAME deterministic providerRequestId.
 *
 * It is the single writer of a hold-release authorization, which is what makes
 * the release deliberate. Two row shapes arrive here and both leave authorized,
 * for different reasons:
 *   - providerRequestId NULL (a gate hold, or a hold taken before the Square
 *     payment id landed): no create POST was ever issued for this row, so there
 *     is nothing at APLIIQ to duplicate and nothing to prove absent. What was
 *     missing was never safety, only a per-order human decision — this call is
 *     that decision.
 *   - providerRequestId set: a POST went out and its outcome is unknown. That
 *     one still has to earn its release with the provider-side absence proof
 *     below, and the release is recorded the same way.
 *

 * Resolving the documented contradiction. `lib/apliiq/client.ts` and
 * `submitApliiqFulfillment` state there is no safe POST retry, while
 * docs/APLIIQ_CODEX_HANDOFF.md:405 lists "Apliiq create-order is idempotent" in
 * its definition of done. Those are not the same claim, and only one is
 * verified. APLIIQ publishes no server-side idempotency guarantee on the
 * store-system `id`, and this integration has never observed a duplicate-id
 * rejection, so the handoff line is an integration GOAL, not provider
 * behaviour we may rely on. The defensible position, implemented here:
 *   1. No automatic retry, ever. A POST whose outcome is unknown stays in
 *      manual attention; nothing in the cron or the retry button changes that.
 *   2. A resubmission is permitted only after a provider-side READ positively
 *      shows the order is absent, and only from a human-triggered ops action.
 *      Once absence is proven there is nothing to duplicate, so the submission
 *      is safe whether or not APLIIQ dedupes.
 *   3. The deterministic providerRequestId is reused as a second line of
 *      defence, not the first. If APLIIQ does dedupe on `id` we get idempotency
 *      for free; if it does not, step 2 already covered us.
 * The client's "no retry" comment therefore stays true as written: this is not
 * a retry of an unknown request, it is a first submission of a request the
 * provider demonstrably never received.
 */
export async function forceResubmitApliiqFulfillment(
  orderId: number,
  client?: ApliiqClient
): Promise<ApliiqForceResubmitResult> {
  if (!isDbConfigured()) throw new Error("Production order store is unavailable.");

  const [order] = await db().select({
    externalOrderNumber: orders.externalOrderNumber,
    paymentStatus: orders.paymentStatus,
    squarePaymentId: orders.squarePaymentId,
  }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { outcome: "blocked", reason: "Order not found." };
  if (order.paymentStatus !== "paid") return { outcome: "blocked", reason: "Only paid orders can be resubmitted to APLIIQ." };
  if (!order.squarePaymentId) {
    return { outcome: "blocked", reason: "APLIIQ fulfillment requires a persisted Square payment id." };
  }

  // Releasing the claim while submission is still gated would burn the absence
  // proof on a run that can only re-hold the row, and would tell the operator
  // an order went out when it did not.
  const gated = getApliiqSubmissionBlockReason();
  if (gated) return { outcome: "blocked", reason: gated };

  const [existing] = await db().select({
    id: fulfillments.id,
    providerRequestId: fulfillments.providerRequestId,
    providerOrderId: fulfillments.providerOrderId,
    providerDataJson: fulfillments.providerDataJson,
    status: fulfillments.status,
  }).from(fulfillments).where(and(
    eq(fulfillments.orderId, orderId),
    eq(fulfillments.providerClaimKey, APLIIQ_CLAIM_KEY)
  )).limit(1);

  if (!existing) {
    return { outcome: "blocked", reason: "No APLIIQ claim exists for this order; retry fulfillment creates one." };
  }
  if (existing.providerOrderId) {
    return {
      outcome: "blocked",
      reason: `APLIIQ already holds order ${existing.providerOrderId}; nothing was resubmitted.`,
      providerOrderId: existing.providerOrderId,
    };
  }

  const providerRequestId = apliiqProviderRequestId(orderId);

  if (!existing.providerRequestId) {
    // Held, never POSTed. No provider read is performed or needed: the write
    // ordering documented on startApliiqFulfillment means a NULL request id can
    // only exist on a row that never reached the create call. Authorize this one
    // row, once, and let the ordinary path submit it.
    const authorization = apliiqHoldReleaseAuthorization("never_submitted", existing.status);
    const ttlMinutes = Math.round(APLIIQ_HOLD_RELEASE_TTL_MS / 60_000);
    const authorized = await db().update(fulfillments).set({
      providerDataJson: withApliiqHoldRelease(existing.providerDataJson, authorization),
      lastError: `Ops hold release authorized at ${authorization.authorizedAt}; one submission permitted within ${ttlMinutes} minutes.`.slice(0, 500),
      updatedAt: new Date(),
    }).where(and(
      eq(fulfillments.id, existing.id),
      isNull(fulfillments.providerRequestId),
      isNull(fulfillments.providerOrderId),
    )).returning({ id: fulfillments.id });
    if (!authorized[0]) {
      return { outcome: "blocked", reason: "The APLIIQ claim changed while the hold release was being authorized; nothing was released." };
    }
    await auditApliiqFulfillment(orderId, "fulfillment:apliiq_hold_release_authorized", existing.status, {
      providerRequestId,
      authorization,
    }, existing.status);
    return {
      outcome: "released",
      release: "hold_authorized",
      providerRequestId,
      evidence: {
        checkedAt: authorization.authorizedAt,
        lookups: [],
        recordsScanned: 0,
        basis: "Claim carries no providerRequestId: no APLIIQ create request was ever issued for this order, so there is nothing to prove absent.",
      },
    };
  }

  if (existing.providerRequestId !== providerRequestId) {
    // The reuse guarantee only holds for the deterministic id this codebase
    // writes. An unrecognised value cannot be safely re-derived, so refuse
    // rather than send APLIIQ a second, different `id` for the same order.
    return { outcome: "blocked", reason: `APLIIQ request identity ${existing.providerRequestId} is not the deterministic id for this order; resolve it by hand.` };
  }

  let proof: Awaited<ReturnType<typeof proveApliiqOrderAbsent>>;
  try {
    proof = await proveApliiqOrderAbsent(client ?? createLiveApliiqClient(), {
      providerRequestId,
      externalOrderNumber: order.externalOrderNumber,
    });
  } catch (error) {
    const reason = `APLIIQ absence could not be proven: ${error instanceof Error ? error.message : "provider lookup failed"}`.slice(0, 500);
    await auditApliiqFulfillment(orderId, "fulfillment:apliiq_resubmit_refused", existing.status, {
      providerRequestId,
      reason,
    }, existing.status);
    return { outcome: "blocked", reason };
  }

  if (!proof.absent) {
    const providerOrderId = providerOrderIdValue(proof.record.OrderId);
    // The provider does hold it. Adopt their order id so the row stops looking
    // unsubmitted and webhooks can match it, then refuse the resubmission.
    await db().update(fulfillments).set({
      ...(providerOrderId ? { providerOrderId } : {}),
      lastError: `APLIIQ already holds this order; force resubmit refused at ${proof.evidence.checkedAt}.`.slice(0, 500),
      updatedAt: new Date(),
    }).where(and(
      eq(fulfillments.id, existing.id),
      isNull(fulfillments.providerOrderId),
    ));
    await auditApliiqFulfillment(orderId, "fulfillment:apliiq_resubmit_refused_present", existing.status, {
      providerRequestId,
      ...(providerOrderId ? { providerOrderId } : {}),
      evidence: proof.evidence,
    }, existing.status);
    return {
      outcome: "blocked",
      reason: `APLIIQ already holds this order${providerOrderId ? ` (${providerOrderId})` : ""}; nothing was resubmitted.`,
      ...(providerOrderId ? { providerOrderId } : {}),
    };
  }

  // Absence proven. Clearing providerRequestId returns the row to the exact
  // state holdApliiqFulfillment leaves behind — provably un-POSTed — which is
  // now the truth. The authorization written alongside it is what lets the
  // ordinary submit path act on that state at all; without it the reclaim is
  // inert, exactly as it is for an unreleased gate hold. One-shot twice over:
  // the reclaim consumes the authorization AND writes the id straight back, so
  // a second resubmission needs a second proof and a second ops action.
  const proofAuthorization = apliiqHoldReleaseAuthorization("absence_proven", existing.status);
  const released = await db().update(fulfillments).set({
    providerRequestId: null,
    providerDataJson: withApliiqHoldRelease(existing.providerDataJson, proofAuthorization),
    lastError: `Ops force resubmit: APLIIQ absence proven at ${proof.evidence.checkedAt}; ${providerRequestId} released for one submission.`.slice(0, 500),
    updatedAt: new Date(),
  }).where(and(
    eq(fulfillments.id, existing.id),
    eq(fulfillments.providerRequestId, providerRequestId),
    isNull(fulfillments.providerOrderId),
  )).returning({ id: fulfillments.id });
  if (!released[0]) {
    return { outcome: "blocked", reason: "The APLIIQ claim changed during the absence check; nothing was released." };
  }

  await auditApliiqFulfillment(orderId, "fulfillment:apliiq_resubmit_authorized", existing.status, {
    providerRequestId,
    authorization: proofAuthorization,
    evidence: proof.evidence,
  }, existing.status);
  return { outcome: "released", release: "absence_proven", providerRequestId, evidence: proof.evidence };
}

/**
 * Create one Printful draft per owning store. A unique (order, store) row is claimed before the
 * remote call, preventing concurrent retries from creating two drafts for the same provider store.
 */
export async function startFulfillment(
  orderId: number, cart: RevalidatedCart, contact: OrderContact
): Promise<void> {
  if (!isDbConfigured()) return;

  const providerGroups = groupItemsByFulfillmentProvider(cart.items);
  const defaultStore = Number(process.env.PRINTFUL_STORE_ID) || undefined;
  const byStore = groupSourceItemsByPrintfulStore(providerGroups.printful, defaultStore);
  if (byStore.size === 0 && providerGroups.apliiq.length === 0) {
    await markManualReview(orderId, "No cart item has a supported fulfillment path in its purchase-time provider snapshot.");
    return;
  }

  const addr = (contact.shippingAddress ?? {}) as Record<string, string>;
  const recipient = {
    name: contact.shippingName || contact.email,
    address1: addr.address1,
    city: addr.city,
    state_code: addr.state || undefined,
    country_code: addr.country || "US",
    zip: addr.zip,
    email: contact.email,
  };

  for (const [storeId, items] of Array.from(byStore)) {
    const [existing] = await db().select({
      id: fulfillments.id,
      printfulOrderId: fulfillments.printfulOrderId,
      status: fulfillments.status,
    }).from(fulfillments).where(and(
      eq(fulfillments.orderId, orderId),
      eq(fulfillments.providerStoreId, storeId)
    )).limit(1);

    if (existing?.printfulOrderId) {
      if (shouldRetryPrintfulConfirmation({
        confirmationAllowed: confirmAllowed(), printfulOrderId: existing.printfulOrderId, status: existing.status,
      })) {
        await confirmPrintfulOrder(orderId, existing.id, existing.printfulOrderId, storeId);
      }
      continue;
    }
    if (existing?.status === "draft_creating") {
      await markManualReview(orderId, `Printful store ${storeId} has an unresolved draft creation attempt`);
      continue;
    }

    const claimed = existing
      ? await db().update(fulfillments).set({ status: "draft_creating", lastError: null, updatedAt: new Date() })
          .where(eq(fulfillments.id, existing.id)).returning({ id: fulfillments.id })
      : await db().insert(fulfillments).values({
          orderId, providerStoreId: storeId, providerClaimKey: `printful:${storeId}`, status: "draft_creating",
        }).onConflictDoNothing().returning({ id: fulfillments.id });

    if (!claimed[0]) continue; // another request claimed this order/store pair

    let createdPrintfulOrderId = "";
    try {
      const request = buildStoreOrderRequest(items, recipient);
      if (!request) throw new Error(`No fulfillable Printful items for store ${storeId}`);
      const res = await printfulRequest<PrintfulOrderResponse>("/orders", {
        method: "POST",
        storeId: String(storeId),
        apiVersion: request.apiVersion,
        body: request.body,
      });
      const printfulOrderId = String(res?.data?.id ?? res?.result?.id ?? res?.id ?? "");
      if (!printfulOrderId) throw new Error(`Printful draft order (store ${storeId}) returned no id`);
      createdPrintfulOrderId = printfulOrderId;

      // Persist the remote id before confirmation so any confirmation failure can retry the same
      // Printful order instead of creating a duplicate production order.
      await db().update(fulfillments).set({
        printfulOrderId, status: "draft_created", lastError: null, updatedAt: new Date(),
      }).where(eq(fulfillments.id, claimed[0].id));
      await db().update(orders).set({ printfulOrderId, updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), isNull(orders.printfulOrderId)));
      await db().insert(auditLog).values({
        entityType: "order", entityId: String(orderId), action: "fulfillment:draft_created",
        newStatus: "draft_created", source: "fulfillment", metadataJson: { printfulOrderId, storeId },
      });

      if (confirmAllowed()) {
        await confirmPrintfulOrder(orderId, claimed[0].id, printfulOrderId, storeId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Printful draft creation failed";
      if (!createdPrintfulOrderId) {
        await db().update(fulfillments).set({ status: "manual_review", lastError: message, updatedAt: new Date() })
          .where(eq(fulfillments.id, claimed[0].id));
      }
      await syncOrderFulfillmentStatus(orderId);
      await enqueueOrderNotification(orderId, "fulfillment_attention", { reason: message });
      await dispatchOrderNotifications(5, orderId).catch(() => {});
      throw error;
    }
  }

  if (providerGroups.apliiq.length > 0) {
    await startApliiqFulfillment(orderId, providerGroups.apliiq, contact);
  }

  await syncOrderFulfillmentStatus(orderId);
}
