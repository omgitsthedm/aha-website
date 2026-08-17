import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email/marketing";
import { getSavedCart } from "@/lib/commerce/abandoned-cart";
import { isLegacyCatalogPublic } from "@/lib/commerce/catalog-policy";

export const dynamic = "force-dynamic";

// Returns the saved bag for a token-verified email so the recovery link can
// rebuild it on any device. Read-only; no payment or PII beyond the saved lines.
export async function GET(req: Request) {
  if (!isLegacyCatalogPublic()) {
    return NextResponse.json({
      code: "CATALOG_MIGRATION_IN_PROGRESS",
      error: "Saved carts are unavailable while the store is being updated.",
      items: [],
    }, { status: 410, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("e") || "";
  const token = url.searchParams.get("t") || "";
  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ ok: false, items: [] }, { status: 400 });
  }
  const items = await getSavedCart(email);
  return NextResponse.json({ ok: true, items });
}
