// Webhook persistence + dedupe + status reconciliation (§22/§27). Every event is stored raw before
// processing and deduped via webhook_events UNIQUE(provider, dedupe_key). Processing is best-effort
// and idempotent; a webhook never creates fulfillment (that's the paid-order path) — it reconciles.
import { db, isDbConfigured } from "@/lib/db/client";
import { webhookEvents, orders, shipments, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";

type Json = Record<string, unknown>;
const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((cur, k) => (cur && typeof cur === "object" ? (cur as Json)[k] : undefined), o);

/** Store + dedupe. Returns isNew=false when this event was already recorded. */
export async function recordWebhookEvent(input: {
  provider: string; eventId?: string | null; eventType?: string | null;
  signatureValid: boolean; rawPayload: unknown; dedupeKey: string;
}): Promise<{ isNew: boolean }> {
  if (!isDbConfigured()) return { isNew: true };
  const inserted = await db().insert(webhookEvents).values({
    provider: input.provider, eventId: input.eventId ?? null, eventType: input.eventType ?? null,
    signatureValid: input.signatureValid, rawPayload: input.rawPayload as Json,
    dedupeKey: input.dedupeKey, processingStatus: "received",
  }).onConflictDoNothing().returning({ id: webhookEvents.id });
  return { isNew: inserted.length > 0 };
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

/** Printful: reconcile fulfillment + shipment status. */
export async function applyPrintfulEvent(event: unknown): Promise<void> {
  if (!isDbConfigured()) return;
  const type = String(get(event, "type") || "");
  const printfulOrderId = String(
    get(event, "data", "order", "id") ?? get(event, "data", "shipment", "order_id") ?? ""
  );
  if (!printfulOrderId) return;
  const [ord] = await db().select({ id: orders.id })
    .from(orders).where(eq(orders.printfulOrderId, printfulOrderId)).limit(1);
  if (!ord) return;

  if (type === "package_shipped" || type === "shipment_sent") {
    const ship = get(event, "data", "shipment") as Json | undefined;
    await db().update(orders)
      .set({ fulfillmentStatus: "shipped", customerStatus: "Shipped", updatedAt: new Date() })
      .where(eq(orders.id, ord.id));
    await db().insert(shipments).values({
      orderId: ord.id, printfulShipmentId: String(ship?.id ?? ""),
      carrier: String(ship?.carrier ?? "") || null, trackingNumber: String(ship?.tracking_number ?? "") || null,
      trackingUrl: String(ship?.tracking_url ?? "") || null, status: "shipped", shippedAt: new Date(),
      dataJson: ship ?? null,
    });
    await audit(ord.id, "webhook:shipped", "shipped", { printfulOrderId });
  } else if (type === "order_failed" || type === "order_put_hold") {
    await db().update(orders).set({ fulfillmentStatus: "manual_review", updatedAt: new Date() }).where(eq(orders.id, ord.id));
    await audit(ord.id, "webhook:hold", "manual_review", { type, printfulOrderId });
  } else if (type === "order_canceled") {
    await db().update(orders).set({ fulfillmentStatus: "canceled", customerStatus: "Canceled", updatedAt: new Date() }).where(eq(orders.id, ord.id));
    await audit(ord.id, "webhook:canceled", "canceled", { printfulOrderId });
  }
}
