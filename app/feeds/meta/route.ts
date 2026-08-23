import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/square/catalog";
import { buildChannelListings, buildMetaProductFeed } from "@/lib/seo/product-feed";

// Meta Commerce Manager CSV, one already-sellable variant per row.
export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

export async function GET() {
  try {
    const products = await getAllProducts();
    const csv = buildMetaProductFeed(buildChannelListings(products, BASE_URL));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="after-hours-agenda-products.csv"',
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("meta feed failed", error);
    return new NextResponse("", { status: 503 });
  }
}
