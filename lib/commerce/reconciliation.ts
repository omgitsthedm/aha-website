import { and, asc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { auditLog, fulfillments, orderItems, orders } from "@/db/schema";
import { startFulfillment } from "./fulfillment";
import { revalidateCartForFulfillmentRetry, type OrderContact, type RevalidatedCart } from "./orders";
import {
  FulfillmentSnapshotError,
  isLegacyPrintfulSnapshotRepairEligible,
  rebuildFulfillmentCartFromSnapshots,
  type PersistedFulfillmentItem,
} from "./fulfillment-snapshot";
import { ACCEPTED_UNPROCESSED_STATUS } from "./fulfillment-state";
import {
  apliiqFulfillmentStatusFor,
  applyApliiqFulfillmentEvent,
  nextApliiqFulfillmentStatus,
} from "./apliiq-webhook-events";
import { createLiveApliiqClient } from "@/lib/fulfillment/apliiq-adapter";
import { getApliiqOrder, normalizeApliiqOrderTracking } from "@/lib/apliiq/orders";
import type { ApliiqOrderRecord, NormalizedApliiqTracking } from "@/lib/apliiq/types";

async function markFulfillmentManualReview(orderId: number, reason: string): Promise<void> {
  const safeReason = reason.slice(0, 500);
  await db().update(orders).set({
    fulfillmentStatus: "manual_review", customerStatus: "Action needed", updatedAt: new Date(),
  }).where(eq(orders.id, orderId));
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action: "fulfillment:manual_review",
    newStatus: "manual_review", source: "reconciliation", metadataJson: { reason: safeReason },
  });
}

function assertLegacyRepairMatchesPaidItems(cart: RevalidatedCart, items: PersistedFulfillmentItem[]): void {
  if (cart.items.length !== items.length) throw new Error("Legacy Printful repair changed the paid order item count");
  for (let index = 0; index < items.length; index += 1) {
    const paid = items[index];
    const repaired = cart.items[index];
    if (repaired.fulfillmentProvider !== "printful" || paid.ahaProductId !== repaired.ahaProductId ||
      paid.ahaVariantId !== repaired.ahaVariantId || paid.sku !== repaired.sku ||
      paid.squareVariationId !== repaired.squareVariationId ||
      (paid.printfulCatalogVariantId && paid.printfulCatalogVariantId !== repaired.printfulCatalogVariantId)) {
      throw new Error("Legacy Printful repair did not match the immutable paid item identity");
    }
  }
}

export async function retryOrderFulfillment(orderId: number): Promise<void> {
  if (!isDbConfigured()) throw new Error("Production order store is unavailable.");
  const [order] = await db().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.paymentStatus !== "paid") throw new Error("Only paid orders can enter fulfillment.");
  const items = await db().select().from(orderItems).where(eq(orderItems.orderId, orderId)) as PersistedFulfillmentItem[];
  if (!items.length) throw new Error("Order has no fulfillment items.");

  // Paid orders use the provider/art/SKU captured at purchase time. The only
  // live-catalog exception is a strictly-identical legacy Printful repair for
  // records that genuinely predate snapshots; malformed snapshots never fall
  // through to current catalog data.
  let cart: RevalidatedCart;
  try {
    cart = rebuildFulfillmentCartFromSnapshots(items, order.currency, order.subtotalAmount);
  } catch (error) {
    const canRepairLegacyPrintful = error instanceof FulfillmentSnapshotError && error.kind === "missing" &&
      isLegacyPrintfulSnapshotRepairEligible(items);
    if (!canRepairLegacyPrintful) {
      const reason = error instanceof Error ? error.message : "Paid order fulfillment snapshot could not be reconstructed";
      await markFulfillmentManualReview(order.id, reason);
      throw error;
    }
    try {
      const derived = revalidateCartForFulfillmentRetry(
        items.map((item) => ({ squareVariationId: item.squareVariationId || "", quantity: item.quantity }))
      );
      assertLegacyRepairMatchesPaidItems(derived, items);
      cart = { currency: order.currency, subtotal: order.subtotalAmount, items: derived.items };
    } catch (repairError) {
      const reason = repairError instanceof Error ? repairError.message : "Legacy Printful repair failed";
      await markFulfillmentManualReview(order.id, reason);
      throw repairError;
    }
  }
  const contact: OrderContact = {
    email: order.email,
    phone: order.phone || undefined,
    shippingName: order.shippingName || undefined,
    shippingAddress: (order.shippingAddressJson || undefined) as Record<string, unknown> | undefined,
  };
  await startFulfillment(order.id, cart, contact);
}

export async function reconcilePaidOrders(limit = 5): Promise<{ attempted: number; failed: number }> {
  if (!isDbConfigured()) return { attempted: 0, failed: 0 };
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  await db().update(fulfillments).set({ status: "manual_review", lastError: "Recovered stale draft claim", updatedAt: new Date() })
    .where(and(eq(fulfillments.status, "draft_creating"), lt(fulfillments.updatedAt, staleBefore)));
  const candidates = await db().select({ id: orders.id }).from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), inArray(orders.fulfillmentStatus, ["not_started", "manual_review", "draft_creating"])))
    .limit(limit);
  let failed = 0;
  for (const candidate of candidates) {
    try { await retryOrderFulfillment(candidate.id); } catch { failed += 1; }
  }
  return { attempted: candidates.length, failed };
}


// ── APLIIQ stall sweep ───────────────────────────────────────────────────────
// reconcilePaidOrders above only revisits not_started / manual_review /
// draft_creating, so a submitted order that reaches draft_created is never
// looked at again. With the Fulfillment callback URL blank in APLIIQ's
// dashboard — which is its state today — no webhook ever arrives either, and
// the shopper sits on "Preparing your order" forever. This sweep is the pull
// half of that contract: it asks APLIIQ what actually happened.

/** Poll a submitted APLIIQ order again once it has been quiet this long. */
export const APLIIQ_SWEEP_STALE_MS = 60 * 60 * 1000;

/** Provider states this sweep will re-poll. Terminal states are left alone. */
export const APLIIQ_SWEEP_STATUSES = ["draft_created", ACCEPTED_UNPROCESSED_STATUS, "confirmed"] as const;

export interface ApliiqSweepAssessment {
  tracking: NormalizedApliiqTracking;
  /** APLIIQ's own unit count for the order, when it reported one. */
  providerTotalQty?: number;
  /** Set when the record itself is the problem, not just its status. */
  attentionReason?: string;
}


function awaitingFlags(record: ApliiqOrderRecord): string[] {
  const flags: Array<[string, boolean | undefined]> = [
    ["garment", record.AwaitingGarment],
    ["artwork", record.AwaitingArtwork],
    ["supplies", record.AwaitingSupplies],
  ];
  return flags.filter(([, value]) => Boolean(value)).map(([label]) => label);
}

function selectOrderRecord(
  records: readonly ApliiqOrderRecord[],
  providerOrderId: string
): ApliiqOrderRecord | undefined {
  const exact = records.find((record) => (
    record.OrderId !== undefined && String(record.OrderId).trim() === providerOrderId
  ));
  if (exact) return exact;
  // The endpoint is documented as an array even for a single order id, so an
  // unlabelled single record is still this order. Two unlabelled records are
  // not attributable and must not be guessed at.
  return records.length === 1 ? records[0] : undefined;
}

/**
 * Turn one provider order record into a reconciliation decision. Pure: every
 * money-relevant branch here is unit-testable without a database or a network.
 *
 * TotalQty is the silent-mutation detector — APLIIQ can accept an order and
 * drop a line item, and the unit count is the only place that shows up.
 */
export function assessApliiqOrderRecord(input: {
  providerOrderId: string;
  submittedQuantity: number;
  records: readonly ApliiqOrderRecord[];
}): ApliiqSweepAssessment {
  const record = selectOrderRecord(input.records, input.providerOrderId);
  if (!record) {
    return {
      tracking: { status: "attention", trackingNumbers: [], trackingUrls: [] },
      attentionReason: `APLIIQ returned no attributable order record for provider order ${input.providerOrderId}.`,
    };
  }

  const tracking = normalizeApliiqOrderTracking(record);
  const reasons: string[] = [];
  // AwaitingGarment / AwaitingArtwork / AwaitingSupplies are ORDINARY states —
  // APLIIQ waits on blank stock, art approval or supplies as a matter of
  // course. Worth an operator flag; not worth overriding the reported status.
  // Doing that drove the row to manual_review, which is absorbing AND outside
  // APLIIQ_SWEEP_STATUSES, so the sweep never looked at the order again, retry
  // and force-resubmit both refused it, and it sat on "Action needed" forever
  // while APLIIQ shipped it.
  const awaiting = awaitingFlags(record);
  if (awaiting.length > 0) {
    reasons.push(`APLIIQ is awaiting ${awaiting.join(", ")} for provider order ${input.providerOrderId}.`);
  }
  const providerTotalQty = typeof record.TotalQty === "number" && Number.isFinite(record.TotalQty)
    ? record.TotalQty
    : undefined;
  // A unit count that disagrees with the paid order is not a delay: APLIIQ
  // accepted the order and silently dropped a line. Nothing the headline status
  // says can be trusted over that, so this one does override it.
  let contradictsPaidOrder = false;
  if (providerTotalQty !== undefined && input.submittedQuantity > 0 && providerTotalQty !== input.submittedQuantity) {
    reasons.push(`APLIIQ reports ${providerTotalQty} unit(s) for provider order ${input.providerOrderId}; the paid order submitted ${input.submittedQuantity}.`);
    contradictsPaidOrder = true;
  }

  return {
    ...(providerTotalQty === undefined ? {} : { providerTotalQty }),
    ...(reasons.length === 0 ? {} : { attentionReason: reasons.join(" ").slice(0, 500) }),
    // A contradiction outranks the reported status. A delay does not: the order
    // is exactly where APLIIQ says it is, carrying a flag.
    tracking: contradictsPaidOrder ? { ...tracking, status: "attention" } : tracking,
  };
}

export interface ApliiqSweepResult {
  examined: number;
  advanced: number;
  flagged: number;
  failed: number;
  skipped: "not_configured" | "no_credentials" | null;
}

export interface ApliiqSweepOptions {
  limit?: number;
  staleAfterMs?: number;
  now?: Date;
  /** Injected in tests; production resolves the live read-only client. */
  getOrder?: (providerOrderId: string) => Promise<ApliiqOrderRecord[]>;
}

/**
 * Re-poll stalled APLIIQ orders and reconcile them through the same code path
 * the webhook uses. This is read-only against the provider (`GET /Order/{id}`),
 * so it is deliberately NOT behind the order-submission gates — those guard
 * creating orders, and refusing to look at an order we already submitted would
 * be the failure this sweep exists to prevent.
 */
export async function sweepStalledApliiqFulfillments(
  options: ApliiqSweepOptions = {}
): Promise<ApliiqSweepResult> {
  const empty: ApliiqSweepResult = { examined: 0, advanced: 0, flagged: 0, failed: 0, skipped: null };
  if (!isDbConfigured()) return { ...empty, skipped: "not_configured" };

  let getOrder = options.getOrder;
  if (!getOrder) {
    let client;
    try {
      client = createLiveApliiqClient();
    } catch {
      // No credentials in this context. Nothing to reconcile against, and this
      // must never fail the cron that also dispatches queued email.
      return { ...empty, skipped: "no_credentials" };
    }
    getOrder = (providerOrderId: string) => getApliiqOrder(client, providerOrderId);
  }

  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - (options.staleAfterMs ?? APLIIQ_SWEEP_STALE_MS));
  const stalled = await db().select({
    id: fulfillments.id,
    orderId: fulfillments.orderId,
    status: fulfillments.status,
    providerOrderId: fulfillments.providerOrderId,
  }).from(fulfillments).where(and(
    eq(fulfillments.fulfillmentProvider, "apliiq"),
    isNotNull(fulfillments.providerOrderId),
    inArray(fulfillments.status, [...APLIIQ_SWEEP_STATUSES]),
    lt(fulfillments.updatedAt, cutoff),
  )).orderBy(asc(fulfillments.updatedAt)).limit(options.limit ?? 5);

  const result = { ...empty, examined: stalled.length };
  for (const row of stalled) {
    const providerOrderId = row.providerOrderId;
    if (!providerOrderId || !row.orderId) continue;
    let records: ApliiqOrderRecord[];
    try {
      records = await getOrder(providerOrderId);
    } catch {
      // A transport failure is not evidence about the order. Leave the row
      // exactly as it is so the next run tries again.
      result.failed += 1;
      continue;
    }

    const submitted = await db().select({ quantity: orderItems.quantity })
      .from(orderItems).where(and(
        eq(orderItems.orderId, row.orderId),
        eq(orderItems.fulfillmentProvider, "apliiq"),
      ));
    const submittedQuantity = submitted.reduce((total, line) => total + line.quantity, 0);
    const assessment = assessApliiqOrderRecord({
      providerOrderId,
      submittedQuantity,
      records: Array.isArray(records) ? records : [],
    });

    const target = nextApliiqFulfillmentStatus(row.status, apliiqFulfillmentStatusFor(assessment.tracking.status));
    if (target !== row.status) result.advanced += 1;
    if (assessment.attentionReason) result.flagged += 1;

    // The sweep has just re-read the whole provider record, so it is the one
    // caller entitled to retire a flag: an Awaiting* hold that has lifted stops
    // showing in the ops queue instead of latching there for good.
    await applyApliiqFulfillmentEvent({
      payload: { fulfillment: { order_id: providerOrderId } },
      reference: { providerOrderId },
      tracking: assessment.tracking,
      ...(assessment.attentionReason
        ? { attentionReason: assessment.attentionReason }
        : { clearAttention: true }),
    });

    // Record the receipt quantity and stamp the row even when nothing changed,
    // so a quiet order is re-polled once per staleAfterMs instead of on every
    // 15-minute cron tick.
    await db().update(fulfillments).set({
      ...(assessment.providerTotalQty === undefined ? {} : { providerTotalQty: assessment.providerTotalQty }),
      updatedAt: new Date(),
    }).where(eq(fulfillments.id, row.id));
  }
  return result;
}
