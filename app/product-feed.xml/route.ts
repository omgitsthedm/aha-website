import { getAllProducts } from "@/lib/square/catalog";
import { buildProductFeed } from "@/lib/seo/product-feed";

export const revalidate = 3600;

export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com").replace(/\/$/, "");
  try {
    const products = await getAllProducts();
    return new Response(buildProductFeed(products, baseUrl), {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Product feed generation failed:", error);
    return new Response("Product feed is temporarily unavailable.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
