import { and, asc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { notificationOutbox, orderItems, orders } from "@/db/schema";
import { renderOrderEmail, type OrderEmailKind } from "@/lib/email/templates";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email/resend";

type Payload = { shipmentId?: string; trackingUrl?: string; carrier?: string; trackingNumber?: string; reason?: string };

export async function enqueueOrderNotification(orderId: number, kind: OrderEmailKind, payload: Payload = {}): Promise<void> {
  if (!isDbConfigured()) return;
  const [order] = await db().select({ email: orders.email }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.email) return;
  const suffix = kind === "order_shipped" ? payload.shipmentId || payload.trackingNumber || "shipment" : "primary";
  await db().insert(notificationOutbox).values({
    orderId, kind, recipient: order.email, dedupeKey: `${orderId}:${kind}:${suffix}`, payloadJson: payload,
  }).onConflictDoNothing();
}

export async function dispatchOrderNotifications(limit = 10, onlyOrderId?: number): Promise<{ configured: boolean; attempted: number; sent: number; failed: number }> {
  if (!isDbConfigured() || !isTransactionalEmailConfigured()) return { configured: false, attempted: 0, sent: 0, failed: 0 };
  const where = onlyOrderId
    ? and(eq(notificationOutbox.status, "pending"), eq(notificationOutbox.orderId, onlyOrderId))
    : eq(notificationOutbox.status, "pending");
  const queued = await db().select().from(notificationOutbox).where(where).orderBy(asc(notificationOutbox.createdAt)).limit(limit);
  let sent = 0;
  let failed = 0;
  for (const item of queued) {
    const [order] = await db().select().from(orders).where(eq(orders.id, item.orderId)).limit(1);
    const items = await db().select().from(orderItems).where(eq(orderItems.orderId, item.orderId));
    if (!order || !items.length) continue;
    const payload = (item.payloadJson || {}) as Payload;
    const rendered = renderOrderEmail({
      kind: item.kind as OrderEmailKind, orderNumber: order.externalOrderNumber,
      customerName: order.shippingName, totalAmount: order.totalAmount, currency: order.currency,
      items: items.map((line) => ({ title: line.titleSnapshot, size: line.sizeSnapshot, color: line.colorSnapshot, quantity: line.quantity, lineTotal: line.lineTotal })),
      trackingUrl: payload.trackingUrl, carrier: payload.carrier, trackingNumber: payload.trackingNumber,
    });
    try {
      const providerMessageId = await sendTransactionalEmail({
        idempotencyKey: item.dedupeKey, to: item.recipient, ...rendered,
        ...(item.kind === "fulfillment_attention" ? { bcc: process.env.ORDER_SUPPORT_EMAIL || process.env.RESEND_REPLY_TO } : {}),
      });
      await db().update(notificationOutbox).set({ status: "sent", providerMessageId, sentAt: new Date(), lastError: null, attempts: item.attempts + 1, updatedAt: new Date() }).where(eq(notificationOutbox.id, item.id));
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Email send failed";
      await db().update(notificationOutbox).set({ attempts: item.attempts + 1, lastError: message, updatedAt: new Date() }).where(eq(notificationOutbox.id, item.id));
      failed += 1;
    }
  }
  return { configured: true, attempted: queued.length, sent, failed };
}
