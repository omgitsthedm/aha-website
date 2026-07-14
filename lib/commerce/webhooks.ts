// Webhook persistence + dedupe + status reconciliation (§22/§27). Every event is stored raw before
// processing and deduped via webhook_events UNIQUE(provider, dedupe_key). Processing is best-effort
// and idempotent; a webhook never creates fulfillment (that's the paid-order path) — it reconciles.
import { db, isDbConfigured } from "@/lib/db/client";
import { webhookEvents, orders, fulfillments, shipments, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
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
}): Promise<{ isNew: boolean; eventRecordId: number | null }> {
  if (!isDbConfigured()) return { isNew: true, eventRecordId: null };
  const inserted = await db().insert(webhookEvents).values({
    provider: input.provider, eventId: input.eventId ?? null, eventType: input.eventType ?? null,
    signatureValid: input.signatureValid, rawPayload: input.rawPayload as Json,
    dedupeKey: input.dedupeKey, processingStatus: "received",
  }).onConflictDoNothing().returning({ id: webhookEvents.id });
  return { isNew: inserted.length > 0, eventRecordId: inserted[0]?.id ?? null };
}

export async function markWebhookProcessed(eventRecordId: number | null): Promise<void> {
  if (!eventRecordId || !isDbConfigured()) return;
  await db().update(webhookEvents).set({
    processingStatus: "processed", processedAt: new Date(), lastError: null,
  }).where(eq(webhookEvents.id, eventRecordId));
}

export async function markWebhookFailed(eventRecordId: number | null, error: unknown): Promise<void> {
  if (!eventRecordId || !isDbConfigured()) return;
  const message = error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed";
  const [row] = await db().select({ retryCount: webhookEvents.retryCount })
    .from(webhookEvents).where(eq(webhookEvents.id, eventRecordId)).limit(1);
  await db().update(webhookEvents).set({
    processingStatus: "failed", retryCount: (row?.retryCount ?? 0) + 1,
    lastError: message, processedAt: new Date(),
  }).where(eq(webhookEvents.id, eventRecordId));
}

async function audit(orderId: number, action: string, newStatus: string, meta: Json): Promise<void> {
  await db().insert(auditLog).values({
    entityType: "order", entityId: String(orderId), action, newStatus, source: "webhook", metadataJson: meta,
  });
}

/** Square: reconcile payment + refund status. */
export async function applySquareEvent(event: unknown): Promise<void> {
  if (!isDbConfigured()) return;
  const type = String(get(event, "type") || "");
  if (type.startsWith("payment.")) {
    const status = get(event, "data", "object", "payment", "status");
    const squareOrderId = String(get(event, "data", "object", "payment", "order_id") || "");
    if (status === "COMPLETED" && squareOrderId) {
      const rows = await db().update(orders)
        .set({ paymentStatus: "paid", customerStatus: "Payment confirmed", updatedAt: new Date() })
        .where(eq(orders.squareOrderId, squareOrderId)).returning({ id: orders.id });
      if (rows[0]) await audit(rows[0].id, "webhook:payment", "paid", { squareOrderId });
    }
  } else if (type.startsWith("refund.")) {
    const paymentId = String(get(event, "data", "object", "refund", "payment_id") || "");
    if (paymentId) {
      const rows = await db().update(orders)
        .set({ paymentStatus: "refunded", customerStatus: "Refunded", updatedAt: new Date() })
        .where(eq(orders.squarePaymentId, paymentId)).returning({ id: orders.id });
      if (rows[0]) await audit(rows[0].id, "webhook:refund", "refunded", { paymentId });
    }
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
