import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { orders, pushSubscriptions } from "@/db/schema";
import { isPushConfigured } from "@/lib/push/webpush";

interface SubscribeBody {
  orderNumber?: string;
  email?: string;
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
}

/**
 * Register a browser for a one-shot "your order shipped" push. Same proof of
 * ownership as /api/order-status: exact order number + checkout email.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as SubscribeBody;
  const orderNumber = body.orderNumber?.trim().toUpperCase();
  const email = body.email?.trim().toLowerCase();
  const endpoint = body.subscription?.endpoint?.trim();
  const p256dh = body.subscription?.keys?.p256dh?.trim();
  const auth = body.subscription?.keys?.auth?.trim();

  if (!orderNumber || !email || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing order details or push subscription." }, { status: 400 });
  }
  if (!endpoint.startsWith("https://") || endpoint.length > 2048) {
    return NextResponse.json({ error: "Invalid push endpoint." }, { status: 400 });
  }
  if (!isPushConfigured() || !isDbConfigured()) {
    return NextResponse.json({ error: "Shipping alerts are not available right now." }, { status: 503 });
  }

  let order;
  try {
    [order] = await db().select({ id: orders.id, fulfillmentStatus: orders.fulfillmentStatus })
      .from(orders)
      .where(and(eq(orders.externalOrderNumber, orderNumber), eq(orders.email, email)))
      .limit(1);
  } catch {
    return NextResponse.json({ error: "Shipping alerts are temporarily unavailable." }, { status: 503 });
  }
  if (!order) {
    return NextResponse.json({ error: "No matching order was found." }, { status: 404 });
  }
  if (order.fulfillmentStatus === "shipped" || order.fulfillmentStatus === "delivered") {
    return NextResponse.json({ error: "This order already shipped — tracking is on this page." }, { status: 409 });
  }

  try {
    await db().insert(pushSubscriptions)
      .values({ orderId: order.id, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: [pushSubscriptions.orderId, pushSubscriptions.endpoint],
        set: { p256dh, auth },
      });
  } catch {
    return NextResponse.json({ error: "Could not save the alert. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
