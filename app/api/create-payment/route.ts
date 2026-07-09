import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { squareRequest } from "@/lib/square/client";
import { getSquareLocationId } from "@/lib/commerce/runtime";
import {
  revalidateCart, createOrder, markOrderPaid, markOrderFailed,
  type CheckoutLine, type OrderContact,
} from "@/lib/commerce/orders";

export const dynamic = "force-dynamic";

interface CreatePaymentBody {
  sourceId: string; // single-use payment token from Square Web Payments SDK
  verificationToken?: string; // SCA / 3DS token when present
  lines: CheckoutLine[];
  contact: OrderContact;
}

interface SquarePaymentResponse {
  payment: { id: string; status: string; receipt_url?: string };
}

/**
 * POST /api/create-payment
 * Server revalidates the cart (never trusts client prices), persists the order, then charges via
 * the Square Payments API with an idempotency key. Fulfillment is NOT triggered here — a paid
 * order is picked up by the Printful draft/confirm flow (Phase 4).
 */
export async function POST(request: Request) {
  let body: CreatePaymentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.sourceId || !body.contact?.email || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  // 1) Server-side truth: recompute the cart.
  let cart;
  try {
    cart = revalidateCart(body.lines);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cart could not be validated." },
      { status: 409 }
    );
  }

  // 2) Persist the order before charging.
  let order;
  try {
    order = await createOrder(cart, body.contact);
  } catch (err) {
    console.error("createOrder failed:", err);
    return NextResponse.json({ error: "Could not start the order. Please try again." }, { status: 500 });
  }

  // 3) Charge via Square Payments API (idempotent).
  try {
    const result = await squareRequest<SquarePaymentResponse>("/payments", {
      method: "POST",
      revalidate: 0,
      body: {
        source_id: body.sourceId,
        idempotency_key: randomUUID(),
        amount_money: { amount: order.total, currency: cart.currency },
        location_id: getSquareLocationId(),
        reference_id: order.externalOrderNumber,
        buyer_email_address: body.contact.email,
        note: `After Hours Agenda ${order.externalOrderNumber}`,
        autocomplete: true,
        ...(body.verificationToken ? { verification_token: body.verificationToken } : {}),
      },
    });

    if (result.payment.status !== "COMPLETED" && result.payment.status !== "APPROVED") {
      await markOrderFailed(order.orderId, `status ${result.payment.status}`);
      return NextResponse.json({ error: "Payment was not completed." }, { status: 402 });
    }

    await markOrderPaid(order.orderId, result.payment.id);
    return NextResponse.json({
      ok: true,
      orderNumber: order.externalOrderNumber,
      receiptUrl: result.payment.receipt_url ?? null,
    });
  } catch (err) {
    await markOrderFailed(order.orderId, err instanceof Error ? err.message : "charge error").catch(() => {});
    console.error("Square payment failed:", err);
    return NextResponse.json(
      { error: "We couldn't process the payment. Your card was not charged — try again or use another method." },
      { status: 402 }
    );
  }
}
