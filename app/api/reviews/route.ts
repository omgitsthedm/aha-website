import { NextResponse } from "next/server";
import { getProductReviews, submitReview } from "@/lib/commerce/reviews";

export const dynamic = "force-dynamic";

// GET /api/reviews?slug=... → approved reviews + average (public).
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
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
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
