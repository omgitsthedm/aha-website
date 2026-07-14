// Web Push sender for order-shipped pings. Fire-and-forget by design:
// a push failure must never fail the webhook that triggered it.
// Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (Netlify env).
// The public key also ships to the client as NEXT_PUBLIC_VAPID_PUBLIC_KEY.
import webpush from "web-push";
import { and, eq, isNull } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { pushSubscriptions } from "@/db/schema";

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function ensureVapid(): void {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info@afterhoursagenda.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidReady = true;
}

export interface ShipPushPayload {
  orderNumber: string;
  trackingUrl?: string;
}

/**
 * Notify every not-yet-notified subscription for an order that it shipped.
 * Idempotent: rows are stamped notified_at, and dead endpoints (404/410)
 * are deleted. Returns the number of pushes delivered.
 */
export async function sendOrderShippedPush(orderId: number, payload: ShipPushPayload): Promise<number> {
  if (!isPushConfigured() || !isDbConfigured()) return 0;
  ensureVapid();

  const subs = await db()
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.orderId, orderId), isNull(pushSubscriptions.notifiedAt)));
  if (subs.length === 0) return 0;

  const body = JSON.stringify({
    title: "Your order shipped",
    body: `Order ${payload.orderNumber} is on the way.`,
    url: payload.trackingUrl?.startsWith("https://") ? payload.trackingUrl : "/track-order",
  });

  let delivered = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: 60 * 60 * 24 * 3, urgency: "normal" }
      );
      delivered += 1;
      await db().update(pushSubscriptions)
        .set({ notifiedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db().delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).catch(() => {});
      }
      // Other failures stay unnotified; a webhook retry may deliver later.
    }
  }
  return delivered;
}
