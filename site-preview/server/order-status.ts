import { getDatabase } from "@netlify/database";
import {
  body,
  emailValue,
  failure,
  HttpError,
  json,
  production,
  trackingUrl,
  type Runtime,
} from "./runtime.ts";
type Query = ReturnType<typeof getDatabase>["sql"];
export function customerStatus(payment: string, fulfillment: string) {
  const progress: Record<string, string> = {
    queued: "Preparing your piece",
    confirmed: "In production",
    shipped: "Shipped",
    delivered: "Delivered",
    partially_shipped: "Part of your order has shipped",
    manual_review: "We’re checking your order",
    canceled: "Canceled",
    draft_created: "Preparing your piece",
    not_started: "Order received",
  };
  if (payment === "refunded") return "Refunded";
  const state = progress[fulfillment] || "Order update pending";
  return payment === "partially_refunded"
    ? state + " · Partially refunded"
    : payment === "payment_failed"
      ? "Payment was not completed"
      : state;
}
export async function lookupOrder(
  sql: Query,
  orderNumber: string,
  email: string,
  postalCode: string,
) {
  const rows =
    await sql`SELECT id, external_order_number, payment_status, fulfillment_status, created_at FROM orders
 WHERE external_order_number=${orderNumber} AND lower(email)=${email}
 AND upper(regexp_replace(coalesce(shipping_address_json->>'zip',shipping_address_json->>'postalCode',shipping_address_json->>'postal_code',''),'[^a-zA-Z0-9]','','g'))=${postalCode} LIMIT 1`;
  const order = rows[0];
  if (!order) return null;
  const [items, shipments] = await Promise.all([
    sql`SELECT title_snapshot AS title,size_snapshot AS size,quantity FROM order_items WHERE order_id=${order.id} ORDER BY id`,
    sql`SELECT carrier,tracking_url,status FROM shipments WHERE order_id=${order.id} ORDER BY id`,
  ]);
  return {
    orderNumber: order.external_order_number,
    customerStatus: customerStatus(
      String(order.payment_status),
      String(order.fulfillment_status),
    ),
    placedAt: order.created_at,
    items,
    shipments: shipments.map((s) => ({
      carrier: s.carrier,
      status: s.status,
      trackingUrl: trackingUrl(s.tracking_url),
    })),
  };
}
export async function orderStatus(
  request: Request,
  context: Runtime,
  sqlFactory = () => getDatabase().sql,
) {
  try {
    const input = await body(request);
    const email = emailValue(input.email);
    const orderNumber =
      typeof input.orderNumber === "string"
        ? input.orderNumber.trim().toUpperCase()
        : "";
    const postalCode =
      typeof input.postalCode === "string"
        ? input.postalCode.toUpperCase().replace(/[^A-Z0-9]/g, "")
        : "";
    if (
      !email ||
      !/^[A-Z0-9-]{4,80}$/.test(orderNumber) ||
      !/^[A-Z0-9]{3,12}$/.test(postalCode)
    )
      throw new HttpError(
        400,
        "Enter the order number, checkout email and shipping postal code.",
      );
    if (!production(context, request)) {
      if (
        orderNumber === "AHA-DEMO-1001" &&
        email === "review@example.com" &&
        postalCode === "10001"
      )
        return json({
          preview: true,
          order: {
            orderNumber,
            customerStatus: "Preparing your piece — fictional review order",
            items: [{ title: "Sample garment", size: "M", quantity: 1 }],
            shipments: [],
          },
        });
      throw new HttpError(
        404,
        "No review order matches. Use the test details shown on this page.",
      );
    }
    const order = await Promise.race([
      lookupOrder(sqlFactory(), orderNumber, email, postalCode),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Lookup timeout")),
          5000,
        );
        timer.unref();
      }),
    ]);
    if (!order)
      throw new HttpError(
        404,
        "No matching order was found. Check all three details or contact support.",
      );
    return json({ order });
  } catch (error) {
    return failure(error);
  }
}
