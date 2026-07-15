import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isGiftCardsEnabled, purchaseGiftCard } from "@/lib/square/giftcards";
import { sendTransactionalEmail, isTransactionalEmailConfigured } from "@/lib/email/resend";
import { reportCheckoutError } from "@/lib/commerce/checkout-alert";

export const dynamic = "force-dynamic";

const MIN = 500;    // $5
const MAX = 50000;  // $500

export async function POST(req: Request) {
  if (!isGiftCardsEnabled()) return NextResponse.json({ ok: false, error: "Gift cards aren't available yet." }, { status: 503 });
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const amount = Math.round(Number(body?.amount));
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId : "";
  const buyerEmail = typeof body?.buyerEmail === "string" ? body.buyerEmail.trim().toLowerCase() : "";
  const recipientEmail = typeof body?.recipientEmail === "string" ? body.recipientEmail.trim().toLowerCase() : "";
  const senderName = (typeof body?.senderName === "string" && body.senderName.trim().slice(0, 80)) || "A friend";
  const message = typeof body?.message === "string" ? body.message.slice(0, 300) : "";
  // Stable across client retries so a dropped response can't cause a second charge.
  const idempotencyKey = (typeof body?.idempotencyKey === "string" && body.idempotencyKey.slice(0, 45)) || randomUUID();

  if (!sourceId) return NextResponse.json({ ok: false, error: "Missing payment." }, { status: 400 });
  if (!Number.isInteger(amount) || amount < MIN || amount > MAX) return NextResponse.json({ ok: false, error: `Choose an amount between $${MIN / 100} and $${MAX / 100}.` }, { status: 400 });
  if (!/.+@.+\..+/.test(recipientEmail) || !/.+@.+\..+/.test(buyerEmail)) return NextResponse.json({ ok: false, error: "Valid buyer + recipient emails are required." }, { status: 400 });

  try {
    const { gan } = await purchaseGiftCard({ sourceId, amount, buyerEmail, idempotencyKey });
    if (isTransactionalEmailConfigured()) {
      const dollars = (amount / 100).toFixed(2);
      const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
      const note = message ? `<p style="color:#B0B0B0;line-height:1.6;font-style:italic">"${esc(message)}"</p>` : "";
      const html = `<!doctype html><html><body style="margin:0;background:#1A1A1A;color:#FAFAFA;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;padding:40px 24px"><div style="height:8px;background:linear-gradient(90deg,#FF6B6B 0 25%,#87CEEB 25% 50%,#A8D5BA 50% 75%,#F0C987 75%)"></div><p style="color:#FF6B6B;font-size:12px;font-weight:700;letter-spacing:.08em">After Hours Agenda / Gift card</p><h1 style="font-size:34px;line-height:1;margin:18px 0">${esc(senderName)} sent you $${dollars}</h1><p style="color:#B0B0B0;line-height:1.6">Spend it on anything at afterhoursagenda.com — printed one at a time in New York.</p>${note}<p style="margin:24px 0;padding:16px;border:1px solid #4A4A4A;font-family:monospace;font-size:20px;letter-spacing:2px">${esc(gan)}</p><p style="color:#B0B0B0">Enter this code at checkout. Balance: $${dollars}.</p><p style="margin:28px 0"><a href="https://afterhoursagenda.com/shop" style="background:#FF6B6B;color:#1A1A1A;padding:14px 22px;text-decoration:none;font-weight:700">Start shopping</a></p><p style="font-size:12px;color:#B0B0B0">After Hours Agenda · New York City · afterhoursagenda.com</p></div></body></html>`;
      const text = `${senderName} sent you a $${dollars} After Hours Agenda gift card.${message ? `\n\n"${message}"` : ""}\n\nCode: ${gan}\nBalance: $${dollars}\nEnter it at checkout: https://afterhoursagenda.com/shop`;
      await sendTransactionalEmail({ idempotencyKey: `giftcard:${gan}`, to: recipientEmail, subject: `${senderName} sent you an After Hours Agenda gift card`, html, text }).catch(() => {});
    }
    // Return the code so a failed email never strands it (the buyer paid for it).
    return NextResponse.json({ ok: true, gan });
  } catch (error) {
    // A charge may have succeeded before create/activate failed — page ops so a
    // stranded charge is never silent (mirrors the main create-payment flow).
    void reportCheckoutError({ route: "gift-cards/purchase", stage: "purchase", err: error });
    console.error("Gift card purchase failed:", error);
    return NextResponse.json({ ok: false, error: "We couldn't complete the gift-card purchase. If your card was charged, contact info@afterhoursagenda.com and we'll resolve it." }, { status: 502 });
  }
}
