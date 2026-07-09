import { NextResponse } from "next/server";
import { getCommerceReadinessSnapshot } from "@/lib/commerce/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const token = process.env.AHA_READINESS_TOKEN;
  const isLocal = process.env.NODE_ENV !== "production" && !process.env.NETLIFY;

  if (isLocal) return true;
  if (!token) return false;

  const expected = `Bearer ${token}`;
  return request.headers.get("authorization") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Not found", { status: 404 });
  }

  return NextResponse.json(getCommerceReadinessSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
