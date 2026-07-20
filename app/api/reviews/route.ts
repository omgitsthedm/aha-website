import { NextResponse } from "next/server";
import { getProductReviews, getReviewWall, submitReview } from "@/lib/commerce/reviews";

export const dynamic = "force-dynamic";

// GET /api/reviews?slug=...  → approved reviews + average for one product (public)
// GET /api/reviews?wall=1     → approved reviews across the catalog (public wall)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("wall")) {
    const items = await getReviewWall(12);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=1800" } });
  }
  const slug = params.get("slug")?.trim();
  if (!slug) return NextResponse.json({ items: [], count: 0, average: 0 });
  const summary = await getProductReviews(slug);
  return NextResponse.json(summary, { headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600" } });
}

// POST /api/reviews → submit a review (stored pending, awaits moderation).
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: real users leave this empty; bots fill every field.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true }); // silently accept-and-drop
  }
  const result = await submitReview({
    productSlug: String(body.productSlug || ""),
    rating: Number(body.rating),
    title: typeof body.title === "string" ? body.title : undefined,
    body: String(body.body || ""),
    authorName: String(body.authorName || ""),
    email: typeof body.email === "string" ? body.email : undefined,
    orderNumber: typeof body.orderNumber === "string" ? body.orderNumber : undefined,
    sizePurchased: typeof body.sizePurchased === "string" ? body.sizePurchased : undefined,
    fit: typeof body.fit === "string" ? body.fit : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
