import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email/marketing";
import { unsubscribeEmail } from "@/lib/commerce/abandoned-cart";

export const dynamic = "force-dynamic";

const page = (msg: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>After Hours Agenda</title></head><body style="margin:0;background:#FAFAFA;color:#1A1A1A;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center"><div style="max-width:32rem;padding:2rem;text-align:center"><p style="font-weight:700;letter-spacing:.08em;color:#CE3D56;font-size:12px">AFTER HOURS AGENDA</p><p style="font-size:18px;line-height:1.6;margin-top:1rem">${msg}</p><a href="https://afterhoursagenda.com" style="display:inline-block;margin-top:1.5rem;color:#CE3D56;font-weight:700">Back to the shop →</a></div></body></html>`;

async function run(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "";
  const token = url.searchParams.get("t") || "";
  if (!email || !verifyEmailToken(email, token)) {
    return new NextResponse(page("That unsubscribe link isn't valid. Email info@afterhoursagenda.com and we'll take care of it."), {
      status: 400, headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  await unsubscribeEmail(email);
  return new NextResponse(page("You're unsubscribed from reminder emails. You'll still get updates about orders you place."), {
    status: 200, headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); } // RFC 8058 one-click
