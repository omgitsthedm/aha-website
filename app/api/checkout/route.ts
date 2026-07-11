import { NextResponse } from "next/server";

/**
 * The former Square Payment Link path bypassed AHA's durable order, tax review, idempotency,
 * and Printful reconciliation flow. Keep an explicit tombstone for stale clients while all new
 * checkout traffic uses the on-brand `/checkout` page and `/api/create-payment` pipeline.
 */
export function POST() {
  return NextResponse.json({
    code: "LEGACY_CHECKOUT_DISABLED",
    error: "This checkout path has been retired. Return to your cart and use secure checkout.",
    checkoutUrl: "/checkout",
  }, {
    status: 410,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export function GET() {
  return POST();
}
