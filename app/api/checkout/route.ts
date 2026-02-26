import { NextResponse } from "next/server";
import { squareRequest } from "@/lib/square/client";

interface CheckoutItem {
  catalogObjectId: string;
  quantity: number;
  name: string;
}

interface CheckoutRequestBody {
  items: CheckoutItem[];
  redirectUrl?: string;
}

interface PaymentLinkResponse {
  payment_link: {
    id: string;
    url: string;
    long_url: string;
    order_id: string;
  };
}

/**
 * POST /api/checkout
 *
 * Creates a Square Payment Link (hosted checkout page) from cart items.
 * The customer is redirected to Square's secure checkout to complete payment.
 */
export async function POST(request: Request) {
  try {
    const body: CheckoutRequestBody = await request.json();

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) {
      console.error("SQUARE_LOCATION_ID is not configured");
      return NextResponse.json(
        { error: "Checkout is not configured" },
        { status: 500 }
      );
    }

    // Build the order for the payment link
    const lineItems = body.items.map((item) => ({
      name: item.name,
      quantity: String(item.quantity),
      catalog_object_id: item.catalogObjectId,
    }));

    const idempotencyKey = crypto.randomUUID();
    const redirectUrl =
      body.redirectUrl ||
      `${process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.netlify.app"}/order-confirmed`;

    const response = await squareRequest<PaymentLinkResponse>(
      "/online-checkout/payment-links",
      {
        method: "POST",
        body: {
          idempotency_key: idempotencyKey,
          quick_pay: undefined,
          order: {
            location_id: locationId,
            line_items: lineItems,
          },
          checkout_options: {
            redirect_url: redirectUrl,
            ask_for_shipping_address: true,
          },
        },
        revalidate: 0,
      }
    );

    return NextResponse.json({
      checkoutUrl: response.payment_link.url,
      orderId: response.payment_link.order_id,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown checkout error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
