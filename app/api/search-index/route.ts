import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/square/catalog";

// Lightweight, cached search index for the nav overlay. Served on demand (first
// time a shopper opens search) instead of being fetched in the root layout and
// serialized into EVERY page — which forced a full catalog fetch and inflated
// the HTML on routes that never use search (including /checkout).
export const revalidate = 300;

export async function GET() {
  try {
    const products = await getAllProducts();
    const index = products.map((p) => ({
      name: p.name,
      slug: p.slug,
      priceFormatted: p.priceFormatted,
      image: p.images[0] || "",
    }));
    return NextResponse.json(index, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    // Search degrades to empty results; shopping is unaffected.
    return NextResponse.json([], { status: 200 });
  }
}
