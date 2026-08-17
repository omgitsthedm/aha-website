// Provider-neutral APLIIQ webhook reconciliation. This module never calls a
// provider or sends customer notifications: a signed inbound webhook may only
// reconcile records that already exist in the local fulfillment ledger.
import { and, eq, or, type SQL } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { auditLog, fulfillments, orders, shipments } from "@/db/schema";
import { aggregateFulfillmentStatus } from "./fulfillment-state";
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

function fulfillmentStatusFor(trackingStatus: ApliiqFulfillmentStatus): string {
  switch (trackingStatus) {
    // `confirmed` is the existing cross-provider in-production state. Keep
    // APLIIQ's more granular provider status in providerDataJson/audit data.
    case "pending":
    case "in_production":
    case "ready_to_ship":
      return "confirmed";
    case "shipped":
      return "shipped";
    case "cancelled":
      return "canceled";
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
export function nextApliiqFulfillmentStatus(current: string, requested: string): string {
  if (current === "manual_review") return "manual_review";
  if (current === "shipped" || current === "delivered") {
    if (requested === "shipped") return current;
    return requested === "confirmed" ? current : "manual_review";
  }
  if (current === "canceled") {
    return requested === "canceled" ? current : "manual_review";
  }
  return requested;
}

function customerStatus(status: string): string {
  switch (status) {
    case "confirmed": return "In production";
    case "partially_shipped": return "Partially shipped";
    case "shipped": return "Shipped";
    case "delivered": return "Delivered";
    case "canceled": return "Canceled";
    case "manual_review": return "Action needed";
    default: return "Payment confirmed";
  }
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

async function auditTransition(input: {
  entityType: "order" | "fulfillment" | "shipment";
  entityId: string;
  action: string;
  oldStatus?: string;
  newStatus: string;
  metadata: JsonRecord;
}): Promise<void> {
  await db().insert(auditLog).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    ...(input.oldStatus ? { oldStatus: input.oldStatus } : {}),
    newStatus: input.newStatus,
    source: "webhook",
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

  const matched = await db().select({
    id: fulfillments.id,
    orderId: fulfillments.orderId,
    status: fulfillments.status,
    providerDataJson: fulfillments.providerDataJson,
  }).from(fulfillments).where(and(
    eq(fulfillments.fulfillmentProvider, "apliiq"),
    lookup,
  )).limit(2);

  if (matched.length === 0) return { outcome: "unmatched" };
  if (matched.length > 1) return { outcome: "ambiguous" };

  const fulfillment = matched[0];
  if (!fulfillment.orderId) return { outcome: "unmatched" };
  const requestedStatus = fulfillmentStatusFor(event.tracking.status);
  const targetStatus = nextApliiqFulfillmentStatus(fulfillment.status, requestedStatus);
  const manualReviewReason = event.tracking.status === "unknown"
    ? "Unrecognized APLIIQ fulfillment status; manual review required"
    : event.tracking.status === "attention"
      ? "APLIIQ reported a fulfillment exception; manual review required"
      : targetStatus === "manual_review"
        ? `APLIIQ webhook conflicts with existing ${fulfillment.status} fulfillment state; manual review required`
        : null;
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

  if (fulfillment.status !== targetStatus) {
    await db().update(fulfillments).set({
      status: targetStatus,
      providerDataJson: providerData,
      lastError: manualReviewReason,
      updatedAt: new Date(),
    }).where(eq(fulfillments.id, fulfillment.id));
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
    if (targetStatus === "manual_review") {
      await enqueueOrderNotification(fulfillment.orderId, "fulfillment_attention", {
        reason: manualReviewReason ?? "APLIIQ fulfillment requires manual review",
      });
    }
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
      customerStatus: customerStatus(orderStatus),
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
    (queuedShipmentNotification || targetStatus === "manual_review")) {
    await dispatchOrderNotifications(5, fulfillment.orderId).catch(() => {});
  }

  return { outcome: "applied", orderId: fulfillment.orderId, fulfillmentId: fulfillment.id };
}
