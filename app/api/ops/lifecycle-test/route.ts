import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";
import { sendAbandonedCartTest } from "@/lib/commerce/abandoned-cart";

// Sends a sample abandoned-cart email to the support address (or a provided
// address) so David can eyeball it before enabling live sends. Ops-guarded.
export async function POST(req: Request) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const to = (typeof body?.to === "string" && body.to) || process.env.ORDER_SUPPORT_EMAIL || process.env.RESEND_REPLY_TO;
  if (!to) return NextResponse.json({ ok: false, error: "No recipient configured." }, { status: 503 });
  try {
    const messageId = await sendAbandonedCartTest(to);
    return NextResponse.json({ ok: true, messageId, to });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Test failed" }, { status: 502 });
  }
}
