import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email/marketing";
import { unsubscribeEmail } from "@/lib/commerce/abandoned-cart";

export const dynamic = "force-dynamic";

// GET renders a confirmation page (NO side effect) so mail-scanner prefetches
// can't silently unsubscribe someone. POST performs the unsubscribe — that's
// both the confirm button and the RFC 8058 List-Unsubscribe-Post one-click path
// (which providers only trigger on genuine user action).
const shell = (msg: string, inner: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>After Hours Agenda</title></head><body style="margin:0;background:#FAFAFA;color:#1A1A1A;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="max-width:32rem;padding:2rem;text-align:center"><p style="font-weight:700;letter-spacing:.08em;color:#CE3D56;font-size:12px">AFTER HOURS AGENDA</p><p style="font-size:18px;line-height:1.6;margin:1rem 0">${msg}</p>${inner}</div></body></html>`;

const escapeAttr = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#039;" }[c] || c));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";
  const token = url.searchParams.get("t") || "";
  if (!email || !verifyEmailToken(email, token)) {
    return new NextResponse(shell("That unsubscribe link isn't valid. Email info@afterhoursagenda.com and we'll take care of it.", ""), {
      status: 400, headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  const action = `/api/lifecycle/unsubscribe?email=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
  const form = `<form method="POST" action="${escapeAttr(action)}"><button type="submit" style="background:#FF6B6B;color:#1A1A1A;border:0;padding:14px 28px;font-weight:700;font-size:15px;cursor:pointer;margin-top:.5rem">Unsubscribe me</button></form><p style="font-size:12px;color:#777;margin-top:1rem">You'll still get updates about orders you place.</p>`;
  return new NextResponse(shell("Unsubscribe from After Hours Agenda reminder emails?", form), {
    status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";
  const token = url.searchParams.get("t") || "";
  if (!email || !verifyEmailToken(email, token)) {
    return new NextResponse(shell("That unsubscribe link isn't valid.", ""), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  await unsubscribeEmail(email);
  return new NextResponse(shell("You're unsubscribed from reminder emails. You'll still get updates about orders you place.", '<a href="https://afterhoursagenda.com" style="display:inline-block;margin-top:1rem;color:#CE3D56;font-weight:700">Back to the shop →</a>'), {
    status: 200, headers: { "content-type": "text/html; charset=utf-8" },
  });
}
