import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email/marketing";
import { getSavedCart } from "@/lib/commerce/abandoned-cart";

export const dynamic = "force-dynamic";

// Returns the saved bag for a token-verified email so the recovery link can
// rebuild it on any device. Read-only; no payment or PII beyond the saved lines.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("e") || "";
  const token = url.searchParams.get("t") || "";
  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ ok: false, items: [] }, { status: 400 });
  }
  const items = await getSavedCart(email);
  return NextResponse.json({ ok: true, items });
}
