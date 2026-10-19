// Product reviews. Only someone holding an order's private link can review the
// pieces in that order, and only once it has shipped. Every review waits for
// the owner's approval in the admin before it appears on the product page.
// Nothing here is invented: with no approved reviews, a product shows none.
import { stageFor, verifyOrderToken } from "../orders/status.mjs";
import { missingTable } from "../updates/signups.mjs";

export class ReviewError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}

const json = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return fallback; } }
  return value;
};

/** The products in an order, one entry each, from the stored line items. */
export function orderProducts(row, products) {
  const byVariation = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.id, product])));
  const bySku = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.sku, product])));
  const found = new Map();
  for (const item of json(row?.submitted_items, [])) {
    const product = byVariation.get(item?.variationId) ?? bySku.get(item?.sku);
    if (product && !found.has(product.slug)) found.set(product.slug, product);
  }
  return [...found.values()];
}

export function cleanReview(input) {
  const rating = Number(input?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError("Choose from one to five stars.");
  const body = typeof input?.body === "string" ? input.body.trim().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n") : "";
  if (body.length < 2) throw new ReviewError("Write a few words about the piece.");
  if (body.length > 600) throw new ReviewError("Keep it to 600 characters.");
  const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (name.length > 40) throw new ReviewError("Keep the name to 40 characters.");
  // An email address or phone number doesn't belong in a public review name.
  if (/@|\d{3}/.test(name)) throw new ReviewError("Use a first name or initials only.");
  return { rating, body, name: name || null };
}

async function shippedOrder(db, env, { o, k }) {
  if (!verifyOrderToken(o, k, env)) throw new ReviewError("We couldn't find that order. Use the link in your order email.", 404);
  const [row] = await db.sql`SELECT state, tracking, apliiq_order_id, submitted_items FROM aha_fulfillment_orders WHERE square_order_id = ${o}`;
  if (!row) throw new ReviewError("We couldn't find that order. Use the link in your order email.", 404);
  return row;
}

/** What the order page offers: each product in the order and any review already left. */
export async function reviewsForOrder(db, env, products, link) {
  const row = await shippedOrder(db, env, link);
  const items = orderProducts(row, products);
  const rows = await db.sql`SELECT product_slug, rating, body, display_name, status FROM aha_reviews WHERE square_order_id = ${link.o}`;
  const existing = new Map(rows.map((review) => [review.product_slug, review]));
  return {
    open: stageFor(row) === "shipped",
    products: items.map((product) => {
      const review = existing.get(product.slug);
      return {
        slug: product.slug, title: product.title, color: product.color, image: product.gallery[0]?.src ?? null,
        review: review ? { rating: Number(review.rating), body: review.body, name: review.display_name, status: review.status } : null,
      };
    }),
  };
}

/** Saves a review (or an edit, which goes back for approval). */
export async function submitReview(db, env, products, input) {
  const row = await shippedOrder(db, env, input);
  if (stageFor(row) !== "shipped") throw new ReviewError("You can review your pieces once your order has shipped.", 409);
  const product = orderProducts(row, products).find((entry) => entry.slug === input?.product);
  if (!product) throw new ReviewError("That piece isn't in this order.", 404);
  const { rating, body, name } = cleanReview(input);
  const [saved] = await db.sql`
    INSERT INTO aha_reviews (square_order_id, product_slug, rating, body, display_name)
    VALUES (${input.o}, ${product.slug}, ${rating}, ${body}, ${name})
    ON CONFLICT (square_order_id, product_slug) DO UPDATE
      SET rating = EXCLUDED.rating, body = EXCLUDED.body, display_name = EXCLUDED.display_name,
          status = 'pending', updated_at = now(), moderated_at = NULL
    RETURNING status`;
  return { product: product.slug, status: saved.status };
}

/** Approved reviews for one product page, newest first. */
export async function publicReviews(db, slug) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) throw new ReviewError("Unknown product.", 404);
  const rows = await db.sql`SELECT rating, body, display_name, updated_at FROM aha_reviews WHERE product_slug = ${slug} AND status = 'approved' ORDER BY updated_at DESC LIMIT 30`;
  const [summary] = await db.sql`SELECT count(*) AS count, avg(rating) AS average FROM aha_reviews WHERE product_slug = ${slug} AND status = 'approved'`;
  const count = Number(summary?.count ?? 0);
  return {
    count,
    average: count ? Math.round(Number(summary.average) * 10) / 10 : null,
    reviews: rows.map((review) => ({ rating: Number(review.rating), body: review.body, name: review.display_name, date: new Date(review.updated_at).toISOString().slice(0, 10) })),
  };
}

/** Admin: reviews by status. Order ids are shortened; reviewers stay anonymous. */
export async function listReviews(db, status = "pending") {
  const wanted = ["pending", "approved", "rejected"].includes(status) ? status : "pending";
  const rows = await db.sql`SELECT id, square_order_id, product_slug, rating, body, display_name, status, created_at, updated_at FROM aha_reviews WHERE status = ${wanted} ORDER BY updated_at DESC LIMIT 100`;
  const [counts] = await db.sql`SELECT count(*) FILTER (WHERE status = 'pending') AS pending, count(*) FILTER (WHERE status = 'approved') AS approved, count(*) FILTER (WHERE status = 'rejected') AS rejected FROM aha_reviews`;
  return {
    counts: { pending: Number(counts?.pending ?? 0), approved: Number(counts?.approved ?? 0), rejected: Number(counts?.rejected ?? 0) },
    reviews: rows.map((review) => ({ id: String(review.id), order: `…${String(review.square_order_id).slice(-6)}`, product: review.product_slug, rating: Number(review.rating), body: review.body, name: review.display_name, status: review.status, createdAt: new Date(review.created_at).toISOString(), updatedAt: new Date(review.updated_at).toISOString() })),
  };
}

/** Admin: approve or reject. Returns the product slug, so its cached reviews can be refreshed. */
export async function moderateReview(db, id, action) {
  if (!/^\d{1,18}$/.test(String(id)) || !["approve", "reject"].includes(action)) throw new ReviewError("Unknown review.", 404);
  const status = action === "approve" ? "approved" : "rejected";
  const [row] = await db.sql`UPDATE aha_reviews SET status = ${status}, moderated_at = now() WHERE id = ${id} RETURNING product_slug, status`;
  if (!row) throw new ReviewError("Unknown review.", 404);
  return { product: row.product_slug, status: row.status };
}

/** Reviews waiting for the owner; 0 until the reviews migration is applied, so the admin overview still loads. */
export async function pendingReviewCount(db) {
  try {
    const [row] = await db.sql`SELECT count(*) AS pending FROM aha_reviews WHERE status = 'pending'`;
    return Number(row?.pending ?? 0);
  } catch (error) {
    if (missingTable(error)) return 0;
    throw error;
  }
}

/** CDN cache tags for one product's public reviews. */
export const reviewTags = (slug) => ["reviews", `reviews-${slug}`];
