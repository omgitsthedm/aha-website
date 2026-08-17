import { NextResponse } from "next/server";

// Legacy Printful measurements are intentionally unavailable during the clean
// catalog reset. Return before parsing input or touching any provider client.
export function GET() {
  return NextResponse.json({
    code: "LEGACY_SIZE_GUIDE_RETIRED",
    error: "Sizing for the previous collection has been retired.",
    table: null,
  }, {
    status: 410,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
