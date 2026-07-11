import { NextResponse } from "next/server";
import { revalidateCart, type CheckoutLine, type OrderContact } from "@/lib/commerce/orders";
import { calculatePricedSquareOrder } from "@/lib/square/orders";
import { getSquareLocationId } from "@/lib/commerce/runtime";

export const dynamic = "force-dynamic";

interface QuoteBody {
  lines: CheckoutLine[];
  contact: OrderContact;
}

function splitName(name?: string): { firstName: string; lastName: string } {
  const parts = (name || "").trim().split(/\s+/);
  return { firstName: parts[0] || "AHA", lastName: parts.slice(1).join(" ") || "Customer" };
}

export async function POST(request: Request) {
  let body: QuoteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
  }

  const address = body.contact?.shippingAddress as Record<string, string> | undefined;
  if (!Array.isArray(body.lines) || !body.lines.length || !address?.address1 || !address.city || !address.zip || !address.country) {
    return NextResponse.json({ error: "Complete the shipping address to calculate the final total." }, { status: 400 });
  }
  if (!getSquareLocationId() || !process.env.SQUARE_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Final pricing is temporarily unavailable." }, { status: 503 });
  }

  let cart;
  try {
    cart = revalidateCart(body.lines);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Cart could not be validated.",
    }, { status: 409 });
  }

  const { firstName, lastName } = splitName(body.contact.shippingName);
  try {
    const quote = await calculatePricedSquareOrder({
      lineItems: cart.items.map((item) => ({
        catalogObjectId: item.squareVariationId,
        quantity: String(item.quantity),
      })),
      shippingAddress: {
        addressLine1: address.address1,
        locality: address.city,
        administrativeDistrictLevel1: address.state || "",
        postalCode: address.zip,
        country: address.country,
        firstName,
        lastName,
      },
    });
    return NextResponse.json({ ok: true, quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Square checkout quote failed:", error);
    return NextResponse.json({
      code: "QUOTE_UNAVAILABLE",
      error: "We couldn't calculate the final tax-inclusive total. Checkout is paused so you are never charged a surprise amount.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
