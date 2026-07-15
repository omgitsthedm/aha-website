import { NextResponse } from "next/server";
import { dispatchAbandonedCarts } from "@/lib/commerce/abandoned-cart";
import { dispatchReviewRequests } from "@/lib/commerce/review-request";
import { dispatchWinback } from "@/lib/commerce/winback";

export const dynamic = "force-dynamic";

// Lifecycle dispatcher, called by the Netlify scheduled function (and safe to
// call manually with the secret). Secret-gated: 404 without it. Runs a dry-run
// unless LIFECYCLE_EMAIL_ENABLED=true, so scheduling it is harmless pre-launch.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || req.headers.get("x-cron-secret") || "";
  return header === `Bearer ${secret}` || header === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return new NextResponse("Not found", { status: 404 });
  const [abandoned, reviews, winback] = await Promise.all([
    dispatchAbandonedCarts().catch((e) => ({ error: String(e) })),
    dispatchReviewRequests().catch((e) => ({ error: String(e) })),
    dispatchWinback().catch((e) => ({ error: String(e) })),
  ]);
  return NextResponse.json({ ok: true, abandoned, reviews, winback });
}

export async function POST(req: Request) { return run(req); }
export async function GET(req: Request) { return run(req); }
