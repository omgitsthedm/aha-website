import { NextResponse } from "next/server";
import {
  isApliiqProductCallbackConfigured,
  isAuthorizedApliiqProductCallback,
  searchApprovedApliiqProducts,
} from "@/lib/apliiq/product-callbacks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export function GET(request: Request) {
  if (!isApliiqProductCallbackConfigured()) return response({ error: "Product callback is not configured." }, 503);
  if (!isAuthorizedApliiqProductCallback(request)) return response({ error: "Unauthorized product callback." }, 401);
  const params = new URL(request.url).searchParams;
  // APLIIQ's dashboard HTML-encodes the saved Search URL, so the term arrives
  // as `token=…&amp;search=TERM` — i.e. under the key `amp;search`. Accept both.
  return response(searchApprovedApliiqProducts(params.get("search") || params.get("amp;search") || ""));
}
