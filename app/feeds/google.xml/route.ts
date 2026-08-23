import { getAllProducts } from "@/lib/square/catalog";
import { buildChannelListings, buildGoogleProductFeed } from "@/lib/seo/product-feed";

export const revalidate = 300;

export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com").replace(/\/$/, "");
  try {
    const products = await getAllProducts();
    return new Response(buildGoogleProductFeed(buildChannelListings(products, baseUrl), baseUrl), {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Google product feed generation failed:", error);
    return new Response("Product feed is temporarily unavailable.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
