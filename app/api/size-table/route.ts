import { NextResponse } from "next/server";
import { getSizeTable, debugSizeTable } from "@/lib/printful/size-table";

// Lazy size-measurement lookup for the PDP size guide. Fetched when the modal
// opens (client-side) so it costs nothing at build/render and can't slow PDPs.
export const revalidate = 86400;

export async function GET(request: Request) {
  const variant = Number(new URL(request.url).searchParams.get("variant"));
  if (!Number.isInteger(variant) || variant <= 0) {
    return NextResponse.json({ table: null });
  }
  if (new URL(request.url).searchParams.get("debug") === "1") {
    return NextResponse.json(await debugSizeTable(variant), { headers: { "Cache-Control": "no-store" } });
  }
  const table = await getSizeTable(variant);
  return NextResponse.json(
    { table },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
