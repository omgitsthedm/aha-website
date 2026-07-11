import { NextResponse } from "next/server";
import { squareRequest } from "@/lib/square/client";
import { createPricedSquareOrder } from "@/lib/square/orders";
import { getSquareLocationId } from "@/lib/commerce/runtime";
import {
  revalidateCart, createOrder, markOrderPaid, markOrderFailed, findPaidOrderByIdempotencyKey,
  type CheckoutLine, type OrderContact,
} from "@/lib/commerce/orders";
import { startFulfillment } from "@/lib/commerce/fulfillment";

export const dynamic = "force-dynamic";

interface CreatePaymentBody {
  sourceId: string; // single-use payment token from Square Web Payments SDK
  idempotencyKey: string; // stable per checkout attempt (client-generated) — dedupes retries
  verificationToken?: string; // SCA / 3DS token when present
  quotedTotal: number; // tax-inclusive total the shopper reviewed before tokenization
  quotedCurrency: string;
  lines: CheckoutLine[];
  contact: OrderContact;
}

interface SquarePaymentResponse {
  payment: { id: string; status: string; receipt_url?: string };
}

function splitName(name?: string): { firstName: string; lastName: string } {
  const parts = (name || "").trim().split(/\s+/);
  return { firstName: parts[0] || "AHA", lastName: parts.slice(1).join(" ") || "Customer" };
}

/**
 * POST /api/create-payment
 * 1) revalidate cart server-side (never trust client prices)
 * 2) create a Square Order so SQUARE computes price + location tax authoritatively
 * 3) persist the internal order with those totals
 * 4) charge via Payments API against the order id with a stable idempotency key
 * Fulfillment starts (Printful DRAFT, confirm gated) only after payment succeeds.
 */
export async function POST(request: Request) {
  let body: CreatePaymentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    !body.sourceId || !body.idempotencyKey || !body.contact?.email || !Array.isArray(body.lines) ||
    !Number.isInteger(body.quotedTotal) || body.quotedTotal < 0 || !body.quotedCurrency
  ) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  const locationId = getSquareLocationId();
  if (!locationId || !process.env.SQUARE_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  // Idempotency: if this attempt already succeeded, return the same order.
  try {
    const existing = await findPaidOrderByIdempotencyKey(body.idempotencyKey);
    if (existing) return NextResponse.json({ ok: true, orderNumber: existing.externalOrderNumber, deduped: true });
  } catch { /* non-fatal */ }

  // 1) Server-side truth: recompute + validate the cart (also yields Printful mapping for fulfillment).
  let cart;
  try {
    cart = revalidateCart(body.lines);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cart could not be validated." },
      { status: 409 }
    );
  }

  // 2) Square prices the order (price + location tax). Shipping address drives destination tax.
  const addr = body.contact.shippingAddress as Record<string, string> | undefined;
  const { firstName, lastName } = splitName(body.contact.shippingName);
  let priced;
  try {
    priced = await createPricedSquareOrder({
      lineItems: cart.items.map((it) => ({ catalogObjectId: it.squareVariationId, quantity: String(it.quantity) })),
      shippingAddress: addr ? {
        addressLine1: addr.address1, locality: addr.city,
        administrativeDistrictLevel1: addr.state, postalCode: addr.zip, country: addr.country,
        firstName, lastName,
      } : undefined,
    });
  } catch (err) {
    console.error("Square order pricing failed:", err);
    return NextResponse.json({ error: "We couldn't price your order. Please try again." }, { status: 409 });
  }

  // The customer must explicitly review the exact tax-inclusive amount that will be charged.
  // If Square changed the price/tax after the quote, stop before persistence or payment.
  if (priced.total !== body.quotedTotal || priced.currency !== body.quotedCurrency) {
    return NextResponse.json({
      code: "QUOTE_CHANGED",
      error: "Your final total changed. Review the updated tax and total before paying.",
      quote: {
        subtotal: priced.subtotal, tax: priced.tax, total: priced.total, currency: priced.currency,
      },
    }, { status: 409 });
  }

  // 3) Persist the order with Square-authoritative totals before charging.
  let order;
  try {
    order = await createOrder(cart, body.contact, priced);
  } catch (err) {
    console.error("createOrder failed:", err);
    return NextResponse.json({ error: "Could not start the order. Please try again." }, { status: 500 });
  }

  // 4) Charge against the Square order (idempotent).
  let payment: SquarePaymentResponse["payment"];
  try {
    const result = await squareRequest<SquarePaymentResponse>("/payments", {
      method: "POST",
      revalidate: 0,
      body: {
        source_id: body.sourceId,
        idempotency_key: body.idempotencyKey,
        order_id: priced.squareOrderId,
        amount_money: { amount: priced.total, currency: priced.currency },
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

  // 5) Charge SUCCEEDED — never tell the customer otherwise. Record + start fulfillment; failures
  //    here are logged for reconciliation, not surfaced as a failed payment.
  try {
    await markOrderPaid(order.orderId, payment.id, body.idempotencyKey, priced.total, priced.currency);
  } catch (err) {
    console.error(`RECONCILE: order ${order.externalOrderNumber} charged (payment ${payment.id}) but DB update failed:`, err);
  }
  try {
    await startFulfillment(order.orderId, cart, body.contact);
  } catch (err) {
    console.error(`FULFILLMENT: order ${order.externalOrderNumber} paid but draft creation failed (will retry):`, err);
  }

  return NextResponse.json({
    ok: true,
    orderNumber: order.externalOrderNumber,
    receiptUrl: payment.receipt_url ?? null,
  });
}
