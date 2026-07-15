import { NextResponse } from "next/server";
import { createLoginToken, isAccountsConfigured } from "@/lib/account/auth";
import { sendTransactionalEmail, isTransactionalEmailConfigured } from "@/lib/email/resend";
import { siteOrigin } from "@/lib/email/marketing";

export const dynamic = "force-dynamic";

// Sends a magic sign-in link. Always returns ok (never reveals whether an email
// exists). The link itself is auth (transactional) — sent regardless of the
// marketing gate.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  if (!isAccountsConfigured() || !isTransactionalEmailConfigured()) {
    return NextResponse.json({ ok: true }); // fail closed but don't leak config
  }
  const token = await createLoginToken(email);
  if (token) {
    const link = `${siteOrigin()}/api/account/login?token=${token}`;
    const html = `<!doctype html><html><body style="margin:0;background:#1A1A1A;color:#FAFAFA;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;padding:40px 24px"><div style="height:8px;background:linear-gradient(90deg,#FF6B6B 0 25%,#87CEEB 25% 50%,#A8D5BA 50% 75%,#F0C987 75%)"></div><p style="color:#FF6B6B;font-size:12px;font-weight:700;letter-spacing:.08em">After Hours Agenda / Sign in</p><h1 style="font-size:34px;line-height:1;margin:18px 0">Your sign-in link</h1><p style="color:#B0B0B0;line-height:1.6">Tap below to sign in. This link works once and expires in 20 minutes. If you didn't request it, ignore this email.</p><p style="margin:28px 0"><a href="${link}" style="background:#FF6B6B;color:#1A1A1A;padding:14px 22px;text-decoration:none;font-weight:700">Sign in</a></p><p style="font-size:12px;color:#B0B0B0">After Hours Agenda · New York City · afterhoursagenda.com</p></div></body></html>`;
    const text = `After Hours Agenda — your sign-in link (works once, expires in 20 min):\n\n${link}\n\nIf you didn't request it, ignore this email.`;
    try {
      await sendTransactionalEmail({ idempotencyKey: `login:${token}`, to: email, subject: "Your After Hours Agenda sign-in link", html, text });
    } catch { /* fail silent — user just re-requests */ }
  }
  return NextResponse.json({ ok: true });
}
