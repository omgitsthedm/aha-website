import { NextResponse } from "next/server";
import { consumeLoginToken, signSession, ACCOUNT_COOKIE, SESSION_MAX_AGE } from "@/lib/account/auth";
import { siteOrigin } from "@/lib/email/marketing";

export const dynamic = "force-dynamic";

// Magic-link sign-in. The GET only RENDERS a confirm page — it never consumes
// the token — so corporate mail scanners (Outlook Safe Links, Proofpoint,
// Mimecast) that prefetch links can't burn the single-use token before the
// real user clicks. Consumption happens on the deliberate POST.
const escapeAttr = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#039;" }[c] || c));

const confirmPage = (token: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · After Hours Agenda</title></head><body style="margin:0;background:#FAFAFA;color:#1A1A1A;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center"><form method="POST" action="/api/account/login" style="max-width:24rem;padding:2rem;text-align:center"><input type="hidden" name="token" value="${escapeAttr(token)}"><p style="font-weight:700;letter-spacing:.08em;color:#CE3D56;font-size:12px">AFTER HOURS AGENDA</p><p style="font-size:18px;line-height:1.5;margin:1rem 0 1.5rem">Tap below to finish signing in.</p><button type="submit" style="background:#FF6B6B;color:#1A1A1A;border:0;padding:14px 28px;font-weight:700;font-size:15px;cursor:pointer">Sign in</button></form></body></html>`;

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return NextResponse.redirect(`${siteOrigin()}/account?error=link`, { status: 303 });
  return new NextResponse(confirmPage(token), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = form ? String(form.get("token") || "") : new URL(req.url).searchParams.get("token") || "";
  const email = await consumeLoginToken(token);
  const res = NextResponse.redirect(`${siteOrigin()}${email ? "/account" : "/account?error=link"}`, { status: 303 });
  if (email) {
    res.cookies.set(ACCOUNT_COOKIE, signSession(email), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
