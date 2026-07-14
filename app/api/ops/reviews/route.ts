import { NextResponse } from "next/server";
import { listReviewsByStatus, moderateReview } from "@/lib/commerce/reviews";

export const dynamic = "force-dynamic";

// Key-guarded review moderation (same guard as other /api/ops/* endpoints:
// 404 when the key is unset or wrong, so the surface is invisible).
function guard(request: Request): NextResponse | null {
  const key = process.env.OPS_MAINTENANCE_KEY;
  if (!key) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("x-maintenance-key") !== key) return new NextResponse("Not found", { status: 404 });
  return null;
}

// GET /api/ops/reviews?status=pending → list for moderation.
export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const statusParam = new URL(request.url).searchParams.get("status");
  const status = statusParam === "approved" || statusParam === "rejected" ? statusParam : "pending";
  const rows = await listReviewsByStatus(status);
  return NextResponse.json({ status, count: rows.length, reviews: rows });
}

// POST /api/ops/reviews  { id, status: "approved"|"rejected", verified? } → moderate.
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  let body: { id?: number; status?: string; verified?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || (body.status !== "approved" && body.status !== "rejected")) {
    return NextResponse.json({ ok: false, error: "Provide id + status (approved|rejected)." }, { status: 400 });
  }
  const ok = await moderateReview(id, body.status, body.verified);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
