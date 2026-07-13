import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { orderItems, orders, shipments } from "@/db/schema";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("database lookup timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { orderNumber?: string; email?: string };
  const orderNumber = body.orderNumber?.trim().toUpperCase();
  const email = body.email?.trim().toLowerCase();
  if (!orderNumber || !email) return NextResponse.json({ error: "Enter the order number and checkout email." }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ error: "Order status is temporarily unavailable. Contact support if you need help now." }, { status: 503 });
  let order;
  try {
    [order] = await withTimeout(
      db().select().from(orders).where(and(eq(orders.externalOrderNumber, orderNumber), eq(orders.email, email))).limit(1),
      3_500,
    );
  } catch {
    return NextResponse.json({ error: "Order status is temporarily unavailable. Contact support if you need help now." }, { status: 503 });
  }
  if (!order) return NextResponse.json({ error: "No matching order was found. Check both entries or contact support." }, { status: 404 });
  const [items, tracking] = await Promise.all([
    db().select({ title: orderItems.titleSnapshot, size: orderItems.sizeSnapshot, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, order.id)),
    db().select({ carrier: shipments.carrier, trackingUrl: shipments.trackingUrl, status: shipments.status }).from(shipments).where(eq(shipments.orderId, order.id)),
  ]);
  return NextResponse.json({ ok: true, order: { orderNumber, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, customerStatus: order.customerStatus, total: order.totalAmount, currency: order.currency, placedAt: order.createdAt, items, shipments: tracking } }, { headers: { "Cache-Control": "no-store" } });
}
