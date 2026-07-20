import { and, desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { reviews } from "@/db/schema";

export interface PublicReview {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  verified: boolean;
  createdAt: string;
}

export interface ReviewSummary {
  items: PublicReview[];
  count: number;
  average: number; // 0 when none
}

const EMPTY: ReviewSummary = { items: [], count: 0, average: 0 };

/** Approved reviews for a product, newest first. Fails open to empty (never
 *  throws into a PDP render) so a DB hiccup can't break the page. */
export async function getProductReviews(slug: string): Promise<ReviewSummary> {
  if (!isDbConfigured()) return EMPTY;
  try {
    const rows = await db()
      .select()
      .from(reviews)
      .where(and(eq(reviews.productSlug, slug), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt))
      .limit(100);
    const count = rows.length;
    const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return {
      count,
      average,
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: r.authorName,
        verified: r.verified,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch {
    return EMPTY;
  }
}

export interface ReviewInput {
  productSlug: string;
  rating: number;
  title?: string;
  body: string;
  authorName: string;
  email?: string;
  orderNumber?: string;
}

/** Store a review as `pending`. Never auto-publishes — moderation approves it
 *  (honesty law: no fake or unmoderated ratings). Validated + length-capped. */
export async function submitReview(input: ReviewInput): Promise<{ ok: boolean; error?: string }> {
  if (!isDbConfigured()) return { ok: false, error: "Reviews are temporarily unavailable." };
  const rating = Math.floor(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Choose a rating from 1 to 5." };
  const body = (input.body || "").trim();
  const authorName = (input.authorName || "").trim();
  const slug = (input.productSlug || "").trim();
  if (!slug) return { ok: false, error: "Missing product." };
  if (body.length < 4 || body.length > 4000) return { ok: false, error: "Write a few words about the piece." };
  if (authorName.length < 1 || authorName.length > 80) return { ok: false, error: "Add a name to display." };
  try {
    await db().insert(reviews).values({
      productSlug: slug,
      rating,
      title: (input.title || "").trim().slice(0, 120) || null,
      body: body.slice(0, 4000),
      authorName: authorName.slice(0, 80),
      email: (input.email || "").trim().slice(0, 160) || null,
      orderNumber: (input.orderNumber || "").trim().slice(0, 40) || null,
      status: "pending",
      verified: false,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not submit your review. Please try again." };
  }
}

// ── Moderation (ops-guarded) ────────────────────────────────────────────────

export interface WallReview extends PublicReview {
  productSlug: string;
}

/** Approved reviews across the whole catalog, newest first — for the site-wide
 *  social-proof wall. Fails open to empty (the wall renders nothing when empty),
 *  so this only ever shows REAL, moderated reviews — never fabricated proof. */
export async function getReviewWall(limit = 12): Promise<WallReview[]> {
  if (!isDbConfigured()) return [];
  try {
    const rows = await db()
      .select()
      .from(reviews)
      .where(eq(reviews.status, "approved"))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      authorName: r.authorName,
      verified: r.verified,
      createdAt: r.createdAt.toISOString(),
      productSlug: r.productSlug,
    }));
  } catch {
    return [];
  }
}

export async function listReviewsByStatus(status: "pending" | "approved" | "rejected", limit = 100) {
  if (!isDbConfigured()) return [];
  try {
    return await db().select().from(reviews).where(eq(reviews.status, status)).orderBy(desc(reviews.createdAt)).limit(limit);
  } catch {
    return [];
  }
}

export async function moderateReview(id: number, status: "approved" | "rejected", verified?: boolean): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    await db()
      .update(reviews)
      .set({ status, ...(verified === undefined ? {} : { verified }), updatedAt: new Date() })
      .where(eq(reviews.id, id));
    return true;
  } catch {
    return false;
  }
}
