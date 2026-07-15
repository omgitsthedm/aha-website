import { NextResponse } from "next/server";
import { captureAbandonedCart, type CaptureLine } from "@/lib/commerce/abandoned-cart";

// Best-effort capture of an in-progress checkout for abandoned-cart recovery.
// ALWAYS returns 200 and never throws to the client — it must never interfere
// with the purchase flow.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email : "";
    const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
    const items: CaptureLine[] = rawItems
      .filter((i: unknown) => i && typeof i === "object")
      .map((i: Record<string, unknown>) => ({
        title: String(i.title ?? "").slice(0, 200),
        size: typeof i.size === "string" ? i.size.slice(0, 40) : null,
        quantity: Math.max(1, Math.min(99, Math.round(Number(i.quantity) || 1))),
        lineTotal: Math.max(0, Math.round(Number(i.lineTotal) || 0)),
        slug: typeof i.slug === "string" ? i.slug.slice(0, 120) : undefined,
      }))
      .filter((i: CaptureLine) => i.title);
    const subtotal = Math.max(0, Math.round(Number(body?.subtotal) || 0));
    const currency = typeof body?.currency === "string" ? body.currency.slice(0, 8) : "USD";
    await captureAbandonedCart({ email, items, subtotal, currency });
  } catch {
    /* swallow — capture is never allowed to affect checkout */
  }
  return NextResponse.json({ ok: true });
}
