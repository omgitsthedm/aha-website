// Provider-neutral APLIIQ webhook reconciliation. This module never calls a
// provider or sends customer notifications: a signed inbound webhook may only
// reconcile records that already exist in the local fulfillment ledger.
import { and, eq, isNotNull, or, type SQL } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { auditLog, fulfillments, orderItems, orders, shipments } from "@/db/schema";
import type { OrderItemFulfillmentStatus } from "@/db/schema";
import {
  ACCEPTED_UNPROCESSED_STATUS,
  PARTIALLY_CANCELED_SHIPPED_STATUS,
  PARTIALLY_CANCELED_STATUS,
  aggregateFulfillmentStatus,
  customerStatusFor,
} from "./fulfillment-state";
import { normalizeApliiqFulfillmentWebhook } from "@/lib/apliiq/webhooks";
import { dispatchOrderNotifications, enqueueOrderNotification } from "./notifications";
import type {
  ApliiqFulfillmentStatus,
  ApliiqFulfillmentWebhookPayload,
  NormalizedApliiqTracking,
} from "@/lib/apliiq/types";

type JsonRecord = Record<string, unknown>;

export interface ApliiqWebhookReference {
  providerOrderId?: string;
  providerRequestId?: string;
  providerReference?: string;
}

export interface ParsedApliiqFulfillmentEvent {
  payload: ApliiqFulfillmentWebhookPayload;
  reference: ApliiqWebhookReference;
  tracking: NormalizedApliiqTracking;
  /**
   * Specific operator-facing reason supplied by a caller that already knows why
   * the order needs attention — the scheduled provider sweep sets it for an
   * Awaiting* flag or a quantity mismatch. Absent for inbound webhooks, which
   * only ever carry the generic provider status.
   */
  attentionReason?: string;
  /**
   * Only a caller that has just re-read the whole provider record may retire an
   * attention flag it can no longer see — that is the scheduled sweep, and only
   * the sweep. An inbound webhook reports one event and knows nothing about the
   * conditions it did not mention, so it must never clear somebody else's flag.
   */
  clearAttention?: boolean;
}

export type ApliiqWebhookApplyResult =
  | { outcome: "held" }
  | { outcome: "unmatched" | "ambiguous" }
  | { outcome: "applied"; orderId: number; fulfillmentId: number };

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonemptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstReference(record: JsonRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = nonemptyString(record[key]) ?? (typeof record[key] === "number" ? String(record[key]) : undefined);
    if (value) return value;
  }
  return undefined;
}

/**
 * Validate the narrow fulfillment envelope before applying any status or
 * shipment data. APLIIQ's documented callback has a `fulfillment` envelope,
 * while accepted aliases make it possible to reconcile the provider order,
 * the original request id, or our immutable provider reference.
 */
export function parseApliiqFulfillmentEvent(payload: unknown): ParsedApliiqFulfillmentEvent | null {
  if (!isRecord(payload) || !isRecord(payload.fulfillment)) return null;
  const fulfillment = payload.fulfillment;
  const reference: ApliiqWebhookReference = {
    providerOrderId: firstReference(fulfillment, ["order_id", "orderId", "OrderId"])
      ?? firstReference(payload, ["order_id", "orderId", "OrderId"]),
    providerRequestId: firstReference(fulfillment, ["request_id", "requestId", "RequestId"])
      ?? firstReference(payload, ["request_id", "requestId", "RequestId"]),
    providerReference: firstReference(fulfillment, [
      "store_system_order_id", "storeSystemOrderId", "StoreSystemOrderId",
      "store_order_id", "storeOrderId", "StoreOrderId", "order_number", "orderNumber", "reference",
    ]) ?? firstReference(payload, [
      "store_system_order_id", "storeSystemOrderId", "StoreSystemOrderId",
      "store_order_id", "storeOrderId", "StoreOrderId", "order_number", "orderNumber", "reference",
    ]),
  };

  if (!reference.providerOrderId && !reference.providerRequestId && !reference.providerReference) {
    return null;
  }

  const normalizedPayload: ApliiqFulfillmentWebhookPayload = {
    fulfillment: {
      ...(reference.providerOrderId ? { order_id: reference.providerOrderId } : {}),
      ...(typeof fulfillment.status === "string" ? { status: fulfillment.status } : {}),
      ...(typeof fulfillment.tracking_company === "string" ? { tracking_company: fulfillment.tracking_company } : {}),
      ...("tracking_numbers" in fulfillment ? { tracking_numbers: fulfillment.tracking_numbers } : {}),
      ...("tracking_urls" in fulfillment ? { tracking_urls: fulfillment.tracking_urls } : {}),
      ...(Array.isArray(fulfillment.line_items) ? { line_items: fulfillment.line_items } : {}),
    },
  };

  return {
    payload: normalizedPayload,
    reference,
    // This normalizer is deliberately called only after the signed JSON
    // envelope and a provider reference have both been validated above.
    tracking: normalizeApliiqFulfillmentWebhook(normalizedPayload),
  };
}

/**
 * Internal spelling is "canceled", ONE L. Typed against the schema's own
 * vocabulary so a two-L "cancelled" fails `tsc` here instead of compiling into
 * a comparison that silently never matches.
 */
const CANCELED_STATUS: OrderItemFulfillmentStatus = "canceled";

/**
 * Row states that mean "some or all of this batch is cancelled money". The
 * shipped resolution belongs here too: a cancellation arriving after the
 * survivors shipped still has to be recorded as money owed, not dropped
 * because the row had already reached its terminal state.
 */
const CANCELLATION_STATUSES: ReadonlySet<string> = new Set([
  CANCELED_STATUS, PARTIALLY_CANCELED_STATUS, PARTIALLY_CANCELED_SHIPPED_STATUS,
]);

export function apliiqFulfillmentStatusFor(trackingStatus: ApliiqFulfillmentStatus): string {
  switch (trackingStatus) {
    // APLIIQ "New": the print shop has the order and has not touched a garment.
    // This used to return `confirmed`, which showed the shopper "In production"
    // for work that had not started.
    case "pending":
      return ACCEPTED_UNPROCESSED_STATUS;
    // `confirmed` is the existing cross-provider in-production state and is now
    // reserved for preparing to release / ready to release / in production /
    // ready to ship. Keep APLIIQ's finer provider status in providerDataJson.
    case "in_production":
    case "ready_to_ship":
      return "confirmed";
    case "shipped":
      return "shipped";
    case "cancelled":
      return CANCELED_STATUS;
    case "attention":
    case "unknown":
      return "manual_review";
  }
}

/**
 * Provider webhooks can arrive out of order. Never let a delayed progress
 * callback reopen a shipped/canceled/manual-review fulfillment. A conflicting
 * terminal callback is itself an operator-attention condition.
 */
/**
 * PARTIALLY_CANCELED_STATUS is deliberately absent: it is not a rung on the
 * production ladder, and ranking it would let the comparison below hold a
 * partial cancellation back behind whatever the row already said.
 */
const PROGRESS_RANK: Record<string, number> = {
  not_started: 0,
  queued: 1,
  draft_creating: 2,
  draft_created: 3,
  [ACCEPTED_UNPROCESSED_STATUS]: 4,
  confirmed: 5,
};

export function nextApliiqFulfillmentStatus(current: string, requested: string): string {
  if (current === "manual_review") return "manual_review";
  if (current === PARTIALLY_CANCELED_SHIPPED_STATUS) {
    // Terminal, and shipped. A late cancel of a batch that has already left the
    // building is a real conflict, not an accounting update.
    if (requested === "manual_review" || requested === CANCELED_STATUS) return "manual_review";
    return current;
  }
  if (current === PARTIALLY_CANCELED_STATUS) {
    // Deliberately NOT absorbing the way manual_review is. A follow-up cancel
    // that finally covers the whole batch collapses to canceled, and a real
    // exception still escalates — but everything else, including the surviving
    // lines shipping, leaves the row partially canceled. The cancelled portion
    // is money still owed to the shopper and must not be summarised away by
    // the lines that did ship.
    //
    // "Partially canceled" is the state of the ROW, though, not the last word
    // on the ORDER. Whether the surviving lines are done is a per-line fact
    // this pure two-argument function cannot see, so the caller resolves it
    // with resolvePartiallyCanceledRowStatus() once the line plan exists.
    // Holding the row here unconditionally is what latched the shopper on
    // "Partially canceled" for good after the survivors shipped.
    if (requested === "manual_review") return "manual_review";
    return requested === CANCELED_STATUS ? CANCELED_STATUS : current;
  }
  if (current === "shipped" || current === "delivered") {
    if (requested === "shipped") return current;
    return requested === "confirmed" ? current : "manual_review";
  }
  if (current === CANCELED_STATUS) {
    // A partial cancel is a subset of a cancel already recorded, not a conflict.
    return CANCELLATION_STATUSES.has(requested) ? current : "manual_review";
  }
  // A late "New" callback must not walk `confirmed` back to
  // accepted_unprocessed and tell the shopper production has not started.
  const currentRank = PROGRESS_RANK[current];
  const requestedRank = PROGRESS_RANK[requested];
  if (currentRank !== undefined && requestedRank !== undefined && requestedRank < currentRank) {
    return current;
  }
  return requested;
}

function referencesWhere(reference: ApliiqWebhookReference): SQL | null {
  const predicates: SQL[] = [];
  if (reference.providerOrderId) predicates.push(eq(fulfillments.providerOrderId, reference.providerOrderId));
  if (reference.providerRequestId) predicates.push(eq(fulfillments.providerRequestId, reference.providerRequestId));
  if (reference.providerReference) predicates.push(eq(fulfillments.providerReference, reference.providerReference));
  if (predicates.length === 0) return null;
  if (predicates.length === 1) return predicates[0] ?? null;
  return or(...predicates) ?? null;
}

function safeProviderData(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function syntheticShipmentId(fulfillmentId: number, trackingNumber: string | undefined): string {
  return `apliiq:${fulfillmentId}:${trackingNumber || "shipment"}`;
}

// ── Per-line fulfillment state ───────────────────────────────────────────────
// order_items.fulfillment_status was written once at insert and never touched
// again, so a cancelled or shipped line left no per-line record anywhere. These
// helpers are pure so the money-lossy cases are testable without a database.

/** The paid order line, as much of it as per-line reconciliation needs. */
export interface ApliiqOrderItemLine {
  id: number;
  sku: string;
  providerSku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  cancelledAmountCents: number;
  fulfillmentStatus: OrderItemFulfillmentStatus;
}

export interface ApliiqLineMatch {
  item: ApliiqOrderItemLine;
  /** Units the callback covers; defaults to the whole paid line. */
  quantity: number;
}

export interface ApliiqLineMatchResult {
  matched: ApliiqLineMatch[];
  /** Callback SKUs no paid APLIIQ line can account for — never silently dropped. */
  unmatched: string[];
}

type ApliiqWebhookLineItem = NonNullable<
  NonNullable<ApliiqFulfillmentWebhookPayload["fulfillment"]>["line_items"]
>[number];

/**
 * ORDER_ITEM_FULFILLMENT_STATUS has no accepted_unprocessed member, and adding
 * one would be a schema change. `queued` is the honest per-line equivalent of
 * "APLIIQ has it, nobody has touched it".
 */
const ORDER_ITEM_STATUS_FOR: Record<string, OrderItemFulfillmentStatus> = {
  [ACCEPTED_UNPROCESSED_STATUS]: "queued",
  draft_created: "draft_created",
  confirmed: "confirmed",
  shipped: "shipped",
  canceled: "canceled",
  manual_review: "manual_review",
};

const ORDER_ITEM_RANK: Record<OrderItemFulfillmentStatus, number> = {
  not_started: 0,
  queued: 1,
  draft_creating: 2,
  draft_created: 3,
  confirmed: 4,
  partially_shipped: 5,
  shipped: 6,
  delivered: 7,
  manual_review: 8,
  canceled: 9,
  refunded: 10,
};

/**
 * Per-line status transitions are forward-only, and the two money states are
 * terminal: a later progress callback can never un-cancel or un-refund a line.
 */
export function nextOrderItemFulfillmentStatus(
  current: OrderItemFulfillmentStatus,
  requested: OrderItemFulfillmentStatus
): OrderItemFulfillmentStatus {
  if (current === "refunded" || current === "canceled") return current;
  if (requested === "canceled" || requested === "manual_review") return requested;
  if (current === "delivered") return current;
  if (current === "shipped" && requested !== "delivered") return current;
  return ORDER_ITEM_RANK[requested] >= ORDER_ITEM_RANK[current] ? requested : current;
}

function normalizedSku(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function coveredQuantity(value: unknown, paidQuantity: number): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() ? Number(value.trim()) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) return paidQuantity;
  return Math.min(parsed, paidQuantity);
}

/**
 * Attribute APLIIQ callback line items to paid order lines by provider SKU. An
 * empty/absent line list means the callback covers the whole APLIIQ batch,
 * which is the only shape the documented fulfillment callback guarantees.
 * A SKU that matches zero or more than one paid line is reported, never guessed.
 */
export function matchApliiqLineItems(
  lines: readonly ApliiqWebhookLineItem[] | undefined,
  items: readonly ApliiqOrderItemLine[]
): ApliiqLineMatchResult {
  if (!lines || lines.length === 0) {
    return { matched: items.map((item) => ({ item, quantity: item.quantity })), unmatched: [] };
  }
  const byItemId = new Map<number, ApliiqLineMatch>();
  const unmatched: string[] = [];
  for (const line of lines) {
    const sku = normalizedSku(line.sku);
    const candidates = sku
      ? items.filter((item) => normalizedSku(item.providerSku) === sku || normalizedSku(item.sku) === sku)
      : [];
    if (candidates.length !== 1) {
      unmatched.push(sku || "(missing sku)");
      continue;
    }
    const item = candidates[0];
    const already = byItemId.get(item.id)?.quantity ?? 0;
    const covered = Math.min(item.quantity, already + coveredQuantity(line.quantity, item.quantity));
    byItemId.set(item.id, { item, quantity: covered });
  }
  return { matched: [...byItemId.values()], unmatched: [...new Set(unmatched)] };
}

/**
 * Cancelled value for one line. Monotonic on purpose: a later callback covering
 * fewer units does not un-cancel money that was already recorded as owed.
 */
export function cancelledAmountForLine(item: ApliiqOrderItemLine, quantity: number): number {
  const amount = quantity >= item.quantity
    ? item.lineTotal
    : Math.min(item.lineTotal, item.unitPrice * quantity);
  return Math.max(item.cancelledAmountCents, amount);
}

/**
 * Does this cancellation account for every paid APLIIQ unit on the order?
 *
 * There is exactly one APLIIQ fulfillment row per order (`apliiq:default`), so
 * the row status is the only place a subset cancel can be recorded. Answering
 * "no" here is what keeps the surviving lines out of a Canceled order.
 *
 * Cumulative, not per-callback: value already cancelled by an earlier callback
 * still counts, so the callback that cancels the last remaining line correctly
 * collapses the row from partially_canceled to canceled. An order with no paid
 * APLIIQ lines to compare against is treated as fully covered, which is the
 * pre-existing whole-batch behaviour.
 */
export function cancellationCoversWholeBatch(
  matched: readonly ApliiqLineMatch[],
  items: readonly ApliiqOrderItemLine[]
): boolean {
  if (items.length === 0) return true;
  const byItemId = new Map(matched.map((match) => [match.item.id, match]));
  return items.every((item) => {
    const match = byItemId.get(item.id);
    const cancelled = match ? cancelledAmountForLine(item, match.quantity) : item.cancelledAmountCents;
    return cancelled >= item.lineTotal;
  });
}

/** The projected end state of one paid line once this callback is applied. */
export interface ApliiqLineOutcome {
  fulfillmentStatus: OrderItemFulfillmentStatus;
  cancelledAmountCents: number;
  lineTotal: number;
}

/** Per-line states that mean this line is out the door. */
const TERMINAL_LINE_STATUSES: ReadonlySet<OrderItemFulfillmentStatus> = new Set<OrderItemFulfillmentStatus>([
  "shipped", "delivered",
]);

/** Nothing more is coming for this line, and it is not coming because it was cancelled. */
function isFullyCancelledLine(line: ApliiqLineOutcome): boolean {
  return line.fulfillmentStatus === CANCELED_STATUS
    || line.fulfillmentStatus === "refunded"
    || (line.lineTotal > 0 && line.cancelledAmountCents >= line.lineTotal);
}

/**
 * Resolve what a partially-canceled ROW should actually say, given where its
 * lines have landed. `nextApliiqFulfillmentStatus` cannot answer this: it sees
 * two status strings, and "did the survivors ship?" is a per-line fact.
 *
 * Returns null when there is nothing cancelled to resolve, so the caller keeps
 * whatever the row already decided.
 *
 * This is the fix for the permanent latch: a partial cancellation whose
 * surviving lines then shipped used to leave the row — and therefore the order,
 * and therefore the only status the shopper can read — on "Partially canceled"
 * with no event in existence that could ever move it again, while an
 * order_shipped email went out saying the opposite.
 */
export function resolvePartiallyCanceledRowStatus(lines: readonly ApliiqLineOutcome[]): string | null {
  if (lines.length === 0) return null;
  const cancelledMoney = lines.some((line) => line.cancelledAmountCents > 0 || isFullyCancelledLine(line));
  if (!cancelledMoney) return null;
  const surviving = lines.filter((line) => !isFullyCancelledLine(line));
  // Nothing survived after all: this was a whole-batch cancellation arriving in
  // pieces, and the row is allowed to collapse.
  if (surviving.length === 0) return CANCELED_STATUS;
  return surviving.every((line) => TERMINAL_LINE_STATUSES.has(line.fulfillmentStatus))
    ? PARTIALLY_CANCELED_SHIPPED_STATUS
    : PARTIALLY_CANCELED_STATUS;
}

// ── Attention flag lifecycle ─────────────────────────────────────────────────

/**
 * Attention reasons a progress callback is allowed to retire by itself.
 *
 * ALLOW-list, not a deny-list, and deliberately so: failing to clear leaves an
 * operator looking at a stale row, while clearing wrongly makes money owed
 * disappear out of the ops queue. An Awaiting* hold is a delay by definition —
 * once APLIIQ has shipped the order it is not still waiting on the garment —
 * and a record the provider could not produce is answered by the provider
 * itself calling us about that order.
 *
 * Cancellation, refund and unmatched-SKU reasons are NOT in here. Those are
 * settled by a human through acknowledgeApliiqAttention(), after the refund.
 *
 * The Awaiting text is built by the scheduled sweep in ./reconciliation.ts;
 * tests pin the exact sentences so a reword there fails here instead of
 * silently turning the clear back off.
 */
const SUPERSEDABLE_ATTENTION_REASONS: readonly RegExp[] = [
  /^APLIIQ is awaiting\b/i,
  /^APLIIQ returned no attributable order record\b/i,
];

/**
 * Row states that both prove the hold has lifted AND put the row beyond the
 * reach of the scheduled sweep (APLIIQ_SWEEP_STATUSES stops at `confirmed`).
 * That combination is what makes the flag permanent, so that is exactly where
 * a progress callback has to retire it. A still-sweepable row is left alone:
 * the sweep re-reads the whole provider record and retires it properly.
 */
const ATTENTION_SUPERSEDING_STATUSES: ReadonlySet<string> = new Set([
  "shipped", "delivered", PARTIALLY_CANCELED_SHIPPED_STATUS,
]);

/**
 * Is every reason on this flag one that the order having shipped answers?
 * Reasons are joined sentence-by-sentence, so a mixed flag (Awaiting garment
 * AND a quantity mismatch) is not supersedable — the mismatch still stands.
 */
export function isAttentionSupersededByProgress(
  reason: string | null | undefined,
  targetStatus: string
): boolean {
  if (!reason || !ATTENTION_SUPERSEDING_STATUSES.has(targetStatus)) return false;
  const sentences = reason.split(/(?<=\.)\s+/).map((part) => part.trim()).filter(Boolean);
  if (sentences.length === 0) return false;
  return sentences.every((sentence) => SUPERSEDABLE_ATTENTION_REASONS.some((pattern) => pattern.test(sentence)));
}

async function auditTransition(input: {
  entityType: "order" | "fulfillment" | "shipment";
  entityId: string;
  action: string;
  oldStatus?: string;
  newStatus: string;
  metadata: JsonRecord;
  /** Manual ops actions are not webhooks and must not be audited as one. */
  source?: string;
}): Promise<void> {
  await db().insert(auditLog).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    ...(input.oldStatus ? { oldStatus: input.oldStatus } : {}),
    newStatus: input.newStatus,
    source: input.source ?? "webhook",
    metadataJson: input.metadata,
  });
}
/**
 * Apply a verified, parsed APLIIQ event to one existing provider fulfillment.
 * It intentionally cannot create fulfillment records or make outbound calls.
 * Ambiguous and unknown provider states remain held/manual-review only.
 */
export async function applyApliiqFulfillmentEvent(
  event: ParsedApliiqFulfillmentEvent
): Promise<ApliiqWebhookApplyResult> {
  if (!isDbConfigured()) return { outcome: "held" };
  const lookup = referencesWhere(event.reference);
  if (!lookup) return { outcome: "unmatched" };

  const matchedRows = await db().select({
    id: fulfillments.id,
    orderId: fulfillments.orderId,
    status: fulfillments.status,
    providerDataJson: fulfillments.providerDataJson,
    attentionAt: fulfillments.attentionAt,
    attentionReason: fulfillments.attentionReason,
  }).from(fulfillments).where(and(
    eq(fulfillments.fulfillmentProvider, "apliiq"),
    lookup,
  )).limit(2);

  if (matchedRows.length === 0) return { outcome: "unmatched" };
  if (matchedRows.length > 1) return { outcome: "ambiguous" };

  const fulfillment = matchedRows[0];
  if (!fulfillment.orderId) return { outcome: "unmatched" };

  // ── Per-line attribution, resolved BEFORE the row status ───────────────────
  // order_items.fulfillment_status was written once at insert and never touched
  // again, so a cancelled or shipped line left no per-line record anywhere.
  //
  // The line attribution also decides the ROW status, which is why it has to
  // run first. There is exactly one APLIIQ fulfillment row per order
  // (`apliiq:default`), so taking the row status straight from the callback
  // header marked the whole order Canceled the moment APLIIQ cancelled a single
  // SKU — telling the shopper the order was gone while the rest was still in
  // production, and poisoning the survivors: `canceled` is terminal, so the
  // later `shipped` callback hit the canceled/shipped conflict and landed in
  // absorbing manual_review.
  const paidLines = await db().select({
    id: orderItems.id,
    sku: orderItems.sku,
    providerSku: orderItems.providerSku,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
    lineTotal: orderItems.lineTotal,
    cancelledAmountCents: orderItems.cancelledAmountCents,
    fulfillmentStatus: orderItems.fulfillmentStatus,
  }).from(orderItems).where(and(
    eq(orderItems.orderId, fulfillment.orderId),
    eq(orderItems.fulfillmentProvider, "apliiq"),
  ));
  const { matched: matchedLines, unmatched } = matchApliiqLineItems(
    event.payload.fulfillment?.line_items,
    paidLines,
  );

  const providerStatus = apliiqFulfillmentStatusFor(event.tracking.status);
  const requestedStatus = providerStatus === CANCELED_STATUS
    && !cancellationCoversWholeBatch(matchedLines, paidLines)
    ? PARTIALLY_CANCELED_STATUS
    : providerStatus;
  // Preliminary: what the two status strings alone can decide. A row held at
  // PARTIALLY_CANCELED_STATUS is resolved against the line plan further down,
  // once there is a line plan to resolve it against.
  const heldStatus = nextApliiqFulfillmentStatus(fulfillment.status, requestedStatus);
  const statusReason = event.tracking.status === "unknown"
    ? "Unrecognized APLIIQ fulfillment status; manual review required"
    : event.tracking.status === "attention"
      ? "APLIIQ reported a fulfillment exception; manual review required"
      : heldStatus === "manual_review"
        ? `APLIIQ webhook conflicts with existing ${fulfillment.status} fulfillment state; manual review required`
        : null;
  // A caller that already knows the specific problem (the scheduled sweep, for
  // an Awaiting* flag or a quantity mismatch) wins over the generic text.
  const providerReason = event.attentionReason?.slice(0, 500) ?? statusReason;
  const providerData = {
    ...safeProviderData(fulfillment.providerDataJson),
    latestWebhook: {
      status: event.tracking.status,
      reference: event.reference,
      trackingNumbers: event.tracking.trackingNumbers,
      trackingUrls: event.tracking.trackingUrls,
      ...(event.tracking.carrier ? { carrier: event.tracking.carrier } : {}),
      receivedAt: new Date().toISOString(),
    },
  };

  // ── Per-line plan ──────────────────────────────────────────────────────────
  // Planned before any write so the money owed can be flagged in the same row
  // update that carries the status.
  //
  // PARTIALLY_CANCELED_STATUS has no per-line equivalent in
  // ORDER_ITEM_FULFILLMENT_STATUS (adding one would be a schema change), so a
  // row held at that state falls back to what the callback itself reported.
  // That is safe because per-line transitions are already forward-only and
  // terminal-safe: a cancelled line cannot be walked back to shipped.
  const lineStatus = ORDER_ITEM_STATUS_FOR[heldStatus] ?? ORDER_ITEM_STATUS_FOR[requestedStatus];
  const cancelApplied = CANCELLATION_STATUSES.has(requestedStatus)
    && CANCELLATION_STATUSES.has(heldStatus);
  const lineWrites: Array<{
    id: number;
    fulfillmentStatus: OrderItemFulfillmentStatus;
    cancelledAmountCents: number;
  }> = [];
  let canceledAmountCents = 0;
  let canceledLines = 0;
  for (const line of matchedLines) {
    const cancelledAmount = cancelApplied
      ? cancelledAmountForLine(line.item, line.quantity)
      : line.item.cancelledAmountCents;
    // A cancel covering only SOME of a line's units must not mark the line
    // canceled: that state is terminal per line and would freeze the units
    // still in production. The money is carried by cancelledAmountCents and by
    // the row's attention flag instead.
    const requestedLineStatus = cancelApplied
      ? (line.quantity >= line.item.quantity ? CANCELED_STATUS : undefined)
      : lineStatus;
    const nextStatus = requestedLineStatus
      ? nextOrderItemFulfillmentStatus(line.item.fulfillmentStatus, requestedLineStatus)
      : line.item.fulfillmentStatus;
    if (cancelledAmount > line.item.cancelledAmountCents) {
      canceledAmountCents += cancelledAmount - line.item.cancelledAmountCents;
      canceledLines += 1;
    }
    if (nextStatus === line.item.fulfillmentStatus && cancelledAmount === line.item.cancelledAmountCents) continue;
    lineWrites.push({ id: line.item.id, fulfillmentStatus: nextStatus, cancelledAmountCents: cancelledAmount });
  }

  // ── Terminal resolution of a partially cancelled row ───────────────────────
  // Where every paid APLIIQ line ends up once the writes above land. Lines this
  // callback did not touch keep their stored state, so the answer is about the
  // whole order, not just the lines APLIIQ happened to name.
  //
  // No extra query: paidLines is already in hand, and the plan above is the
  // only thing about to change it. Neither partial-cancel state has an entry in
  // ORDER_ITEM_STATUS_FOR, so resolving after the line plan cannot change it.
  const plannedLineWrites = new Map(lineWrites.map((write) => [write.id, write]));
  const projectedLines: ApliiqLineOutcome[] = paidLines.map((line) => {
    const planned = plannedLineWrites.get(line.id);
    return {
      fulfillmentStatus: planned?.fulfillmentStatus ?? line.fulfillmentStatus,
      cancelledAmountCents: planned?.cancelledAmountCents ?? line.cancelledAmountCents,
      lineTotal: line.lineTotal,
    };
  });
  const targetStatus = heldStatus === PARTIALLY_CANCELED_STATUS
    ? resolvePartiallyCanceledRowStatus(projectedLines) ?? heldStatus
    : heldStatus;

  // ── Attention flag ─────────────────────────────────────────────────────────
  // attention_* is a flag, not a state: it is raised and retired independently
  // of fulfillment status, so a routine provider hold (APLIIQ waiting on blank
  // stock) reaches the ops queue without freezing the order in manual_review —
  // which is absorbing, and outside APLIIQ_SWEEP_STATUSES, so nothing could
  // ever move the order again.
  const attentionReasons: string[] = [];
  if (providerReason) attentionReasons.push(providerReason);
  if (canceledLines > 0) {
    // Cents, not a formatted currency: the order currency is not in scope
    // here and this text is operator-facing, never customer copy.
    attentionReasons.push(`APLIIQ canceled ${canceledLines} paid line item(s) worth ${canceledAmountCents} cents; no customer refund has been issued.`);
  }
  if (unmatched.length > 0) {
    attentionReasons.push(`APLIIQ referenced line items that do not match this paid order: ${unmatched.join(", ")}.`);
  }
  const attentionReason = attentionReasons.length > 0
    ? attentionReasons.join(" ").slice(0, 500)
    : null;
  const statusChanged = fulfillment.status !== targetStatus;
  // Re-raising the identical reason leaves the original flag time alone, so the
  // ops queue keeps showing how long this has actually been waiting.
  const raisingAttention = attentionReason !== null
    && (!fulfillment.attentionAt || fulfillment.attentionReason !== attentionReason);
  // A progress signal that answers the flag retires it. The scheduled sweep has
  // re-read the whole provider record and may retire anything; an inbound
  // webhook may only retire a reason its own progress supersedes — an Awaiting*
  // hold on an order that has now shipped. Money and data-integrity flags
  // survive both, and are settled by acknowledgeApliiqAttention().
  //
  // Without this, the callback URL going live in APLIIQ's dashboard would make
  // the flag permanent: a real webhook beats the next sweep to the row, the row
  // lands on `shipped`, and `shipped` is outside APLIIQ_SWEEP_STATUSES, so the
  // one caller allowed to clear the flag never looks at the order again.
  const supersedingProgress = attentionReason === null
    && Boolean(fulfillment.attentionAt)
    && isAttentionSupersededByProgress(fulfillment.attentionReason, targetStatus);
  const clearingAttention = attentionReason === null
    && Boolean(fulfillment.attentionAt)
    && (event.clearAttention === true || supersedingProgress);

  if (statusChanged || raisingAttention || clearingAttention) {
    await db().update(fulfillments).set({
      ...(statusChanged ? { status: targetStatus, lastError: providerReason } : {}),
      providerDataJson: providerData,
      ...(raisingAttention ? { attentionAt: new Date(), attentionReason } : {}),
      ...(clearingAttention ? { attentionAt: null, attentionReason: null, lastError: null } : {}),
      updatedAt: new Date(),
    }).where(eq(fulfillments.id, fulfillment.id));
  }
  if (statusChanged) {
    await auditTransition({
      entityType: "fulfillment",
      entityId: String(fulfillment.id),
      action: "webhook:apliiq:fulfillment",
      oldStatus: fulfillment.status,
      newStatus: targetStatus,
      metadata: {
        provider: "apliiq", ...event.reference, providerStatus: event.tracking.status,
        requestedStatus, ...(requestedStatus !== targetStatus ? { heldStatus: targetStatus } : {}),
      },
    });
  }

  let queuedAttentionNotification = false;
  if (raisingAttention || clearingAttention) {
    const lineLevel = canceledLines > 0 || unmatched.length > 0;
    await auditTransition({
      entityType: lineLevel ? "order" : "fulfillment",
      entityId: String(lineLevel ? fulfillment.orderId : fulfillment.id),
      action: lineLevel ? "webhook:apliiq:line-items" : "webhook:apliiq:attention",
      newStatus: targetStatus,
      metadata: {
        provider: "apliiq", ...event.reference,
        ...(attentionReason ? { reason: attentionReason } : { attentionCleared: true }),
        // Which caller retired it, and on the strength of what. A superseded
        // clear names the reason it retired so the flag is still readable
        // after the fact.
        ...(clearingAttention && supersedingProgress
          ? { attentionSupersededBy: targetStatus, supersededReason: fulfillment.attentionReason }
          : {}),
        ...(canceledLines > 0 ? { canceledLines, canceledAmountCents } : {}),
        ...(unmatched.length > 0 ? { unmatchedSkus: unmatched } : {}),
      },
    });
    if (attentionReason && raisingAttention) {
      await enqueueOrderNotification(fulfillment.orderId, "fulfillment_attention", { reason: attentionReason });
      queuedAttentionNotification = true;
    }
  }

  for (const write of lineWrites) {
    await db().update(orderItems).set({
      fulfillmentStatus: write.fulfillmentStatus,
      cancelledAmountCents: write.cancelledAmountCents,
      updatedAt: new Date(),
    }).where(eq(orderItems.id, write.id));
  }

  let queuedShipmentNotification = false;
  if (event.tracking.status === "shipped") {
    const trackingNumbers = event.tracking.trackingNumbers.length > 0
      ? event.tracking.trackingNumbers
      : [undefined];
    for (const trackingNumber of trackingNumbers) {
      const providerShipmentId = syntheticShipmentId(fulfillment.id, trackingNumber);
      const [existingShipment] = await db().select({ id: shipments.id }).from(shipments).where(and(
        eq(shipments.fulfillmentProvider, "apliiq"),
        eq(shipments.providerShipmentId, providerShipmentId),
      )).limit(1);
      if (existingShipment) continue;
      const [shipment] = await db().insert(shipments).values({
        orderId: fulfillment.orderId,
        fulfillmentProvider: "apliiq",
        providerShipmentId,
        carrier: event.tracking.carrier || null,
        trackingNumber: trackingNumber || null,
        trackingUrl: event.tracking.trackingUrls[0] || null,
        status: "shipped",
        shippedAt: new Date(),
        dataJson: { reference: event.reference, providerStatus: event.tracking.status },
      }).onConflictDoNothing().returning({ id: shipments.id });
      if (shipment) {
        await auditTransition({
          entityType: "shipment",
          entityId: String(shipment.id),
          action: "webhook:apliiq:shipment",
          newStatus: "shipped",
          metadata: { provider: "apliiq", providerShipmentId, ...event.reference },
        });
        await enqueueOrderNotification(fulfillment.orderId, "order_shipped", {
          shipmentId: providerShipmentId,
          carrier: event.tracking.carrier,
          trackingNumber,
          trackingUrl: event.tracking.trackingUrls[0],
        });
        queuedShipmentNotification = true;
      }
    }
  }

  const [order] = await db().select({
    fulfillmentStatus: orders.fulfillmentStatus,
  }).from(orders).where(eq(orders.id, fulfillment.orderId)).limit(1);
  const allFulfillments = await db().select({ status: fulfillments.status })
    .from(fulfillments).where(eq(fulfillments.orderId, fulfillment.orderId));
  const orderStatus = aggregateFulfillmentStatus(allFulfillments.map((row) => row.status));
  if (order && order.fulfillmentStatus !== orderStatus) {
    await db().update(orders).set({
      fulfillmentStatus: orderStatus,
      customerStatus: customerStatusFor(orderStatus),
      updatedAt: new Date(),
    }).where(eq(orders.id, fulfillment.orderId));
    await auditTransition({
      entityType: "order",
      entityId: String(fulfillment.orderId),
      action: "webhook:apliiq:order-status",
      oldStatus: order.fulfillmentStatus,
      newStatus: orderStatus,
      metadata: { provider: "apliiq", ...event.reference, providerStatus: event.tracking.status },
    });
  }

  // Preview and branch deploys may share infrastructure, so they only enqueue.
  // Production performs the existing best-effort transactional dispatch.
  if (process.env.CONTEXT === "production" &&
    (queuedShipmentNotification || queuedAttentionNotification)) {
    await dispatchOrderNotifications(5, fulfillment.orderId).catch(() => {});
  }

  return { outcome: "applied", orderId: fulfillment.orderId, fulfillmentId: fulfillment.id };
}

export interface ApliiqAttentionAcknowledgement {
  orderId: number;
  /** Rows whose flag this call retired. 0 means it was already clear. */
  cleared: number;
  /** Exactly what was retired, so the operator can be shown what they dismissed. */
  reasons: string[];
}

/**
 * Manually retire the APLIIQ attention flag on an order.
 *
 * The counterpart to the automatic clears: the sweep retires a hold it can no
 * longer see, a shipped callback retires a hold its own progress supersedes,
 * and this retires the ones neither of them is allowed to touch — money owed
 * on a cancelled line, a SKU that matched no paid line — once a human has
 * actually dealt with them. Before this existed, those flags could only be
 * cleared with SQL, so the honest thing for an operator to do left no trace.
 *
 * Idempotent: acknowledging an order with nothing flagged is a no-op that
 * reports `cleared: 0` rather than raising, so a double-submitted ops form
 * cannot invent an audit entry. Every real clear is audited with the reason it
 * retired, so the flag survives its own dismissal in the record.
 *
 * Deliberately does NOT touch fulfillment status, order status or per-line
 * money. attention_* is a flag, not a state.
 */
export async function acknowledgeApliiqAttention(orderId: number): Promise<ApliiqAttentionAcknowledgement> {
  if (!isDbConfigured()) throw new Error("Production order store is unavailable.");
  if (!Number.isInteger(orderId) || orderId < 1) throw new Error("A valid order id is required.");

  const flagged = await db().select({
    id: fulfillments.id,
    status: fulfillments.status,
    attentionReason: fulfillments.attentionReason,
  }).from(fulfillments).where(and(
    eq(fulfillments.fulfillmentProvider, "apliiq"),
    eq(fulfillments.orderId, orderId),
    isNotNull(fulfillments.attentionAt),
  ));

  if (flagged.length === 0) return { orderId, cleared: 0, reasons: [] };

  const reasons: string[] = [];
  for (const row of flagged) {
    await db().update(fulfillments).set({
      attentionAt: null,
      attentionReason: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(fulfillments.id, row.id));
    if (row.attentionReason) reasons.push(row.attentionReason);
    await auditTransition({
      entityType: "fulfillment",
      entityId: String(row.id),
      action: "ops:apliiq:attention-acknowledged",
      newStatus: row.status,
      source: "ops",
      metadata: {
        provider: "apliiq",
        orderId,
        attentionCleared: true,
        ...(row.attentionReason ? { acknowledgedReason: row.attentionReason } : {}),
      },
    });
  }

  return { orderId, cleared: flagged.length, reasons };
}
