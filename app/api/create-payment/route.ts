import { NextResponse } from "next/server";
import { squareRequest } from "@/lib/square/client";
import { getSquareLocationId } from "@/lib/commerce/runtime";
import {
  revalidateCart, createOrder, markOrderPaid, markOrderFailed, findPaidOrderByIdempotencyKey,
  type CheckoutLine, type OrderContact,
} from "@/lib/commerce/orders";

export const dynamic = "force-dynamic";

interface CreatePaymentBody {
  sourceId: string; // single-use payment token from Square Web Payments SDK
  idempotencyKey: string; // stable per checkout attempt (client-generated) — dedupes retries
  verificationToken?: string; // SCA / 3DS token when present
  lines: CheckoutLine[];
  contact: OrderContact;
}

interface SquarePaymentResponse {
  payment: { id: string; status: string; receipt_url?: string };
}

/**
 * POST /api/create-payment
 * Revalidates the cart server-side (never trusts client prices), persists the order, then charges
 * via the Square Payments API with a STABLE idempotency key so retries never double-charge.
 * Fulfillment is NOT triggered here — a paid order is picked up by the Printful draft/confirm flow.
 */
export async function POST(request: Request) {
  let body: CreatePaymentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.sourceId || !body.idempotencyKey || !body.contact?.email || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  // 0) Fail fast if payment config is missing — don't spray orphaned failed orders.
  const locationId = getSquareLocationId();
  if (!locationId || !process.env.SQUARE_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  // 1) Idempotency: if this attempt already succeeded, return the same order.
  try {
    const existing = await findPaidOrderByIdempotencyKey(body.idempotencyKey);
    if (existing) return NextResponse.json({ ok: true, orderNumber: existing.externalOrderNumber, deduped: true });
  } catch { /* non-fatal: fall through to normal path */ }

  // 2) Server-side truth: recompute the cart.
  let cart;
  try {
    cart = revalidateCart(body.lines);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cart could not be validated." },
      { status: 409 }
    );
  }

  // 3) Persist the order before charging.
  let order;
  try {
    order = await createOrder(cart, body.contact);
  } catch (err) {
    console.error("createOrder failed:", err);
    return NextResponse.json({ error: "Could not start the order. Please try again." }, { status: 500 });
  }

  // 4) Charge via Square Payments API (idempotent).
  let payment: SquarePaymentResponse["payment"];
  try {
    const result = await squareRequest<SquarePaymentResponse>("/payments", {
      method: "POST",
      revalidate: 0,
      body: {
        source_id: body.sourceId,
        idempotency_key: body.idempotencyKey,
        amount_money: { amount: order.total, currency: cart.currency },
        location_id: locationId,
        reference_id: order.externalOrderNumber,
        buyer_email_address: body.contact.email,
        note: `After Hours Agenda ${order.externalOrderNumber}`,
        autocomplete: true,
        ...(body.verificationToken ? { verification_token: body.verificationToken } : {}),
      },
    });
    payment = result.payment;
  } catch (err) {
    await markOrderFailed(order.orderId, err instanceof Error ? err.message : "charge error").catch(() => {});
    console.error("Square payment failed:", err);
    return NextResponse.json(
      { error: "We couldn't process the payment. Your card was not charged — try again or use another method." },
      { status: 402 }
    );
  }

  if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") {
    await markOrderFailed(order.orderId, `status ${payment.status}`).catch(() => {});
    return NextResponse.json({ error: "Payment was not completed." }, { status: 402 });
  }

  // 5) Charge SUCCEEDED. From here we NEVER tell the customer they weren't charged — if the DB
  //    write fails, log for reconciliation and still confirm the order.
  try {
    await markOrderPaid(order.orderId, payment.id, body.idempotencyKey, order.total, cart.currency);
  } catch (err) {
    console.error(
      `RECONCILE: order ${order.externalOrderNumber} (id ${order.orderId}) charged (payment ${payment.id}) but DB update failed:`,
      err
    );
  }

  return NextResponse.json({
    ok: true,
    orderNumber: order.externalOrderNumber,
    receiptUrl: payment.receipt_url ?? null,
  });
}
