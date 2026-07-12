import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";
import { renderOrderEmail } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/resend";

export async function POST() {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const to = process.env.ORDER_SUPPORT_EMAIL || process.env.RESEND_REPLY_TO;
  if (!to) return NextResponse.json({ ok: false, error: "Support email is not configured." }, { status: 503 });
  const rendered = renderOrderEmail({
    kind: "order_confirmed", orderNumber: "AHA-SYSTEM-TEST", totalAmount: 0, currency: "USD",
    items: [{ title: "Production pipeline test — no order created", quantity: 1, lineTotal: 0 }],
  });
  try {
    const messageId = await sendTransactionalEmail({
      idempotencyKey: `ops-test-${randomUUID()}`, to, ...rendered,
    });
    return NextResponse.json({ ok: true, messageId });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Email test failed" }, { status: 502 });
  }
}
