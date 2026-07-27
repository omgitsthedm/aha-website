import { NextResponse } from "next/server";
import { getSizeTable } from "@/lib/printful/size-table";

// Lazy size-measurement lookup for the PDP size guide. Fetched when the modal
// opens (client-side) so it costs nothing at build/render and can't slow PDPs.
//
// MUST stay dynamic. `export const revalidate` makes this handler prerenderable,
// which drops `variant` from Netlify's edge cache key — every product then
// replays the first cached table (tees, hoodies, beanies and socks all showing
// one identical chart). Caching still happens correctly one layer down, in the
// 24h `unstable_cache` inside `getSizeTable`.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const variant = Number(new URL(request.url).searchParams.get("variant"));
  if (!Number.isInteger(variant) || variant <= 0) {
    return NextResponse.json({ table: null });
  }
  const table = await getSizeTable(variant);
  return NextResponse.json(
    { table },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
