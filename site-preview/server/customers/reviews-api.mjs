// /api/reviews: approved reviews for a product page (cached at the CDN until the
// owner approves or rejects one), and the order page's review form.
import { purgeCache } from "@netlify/functions";
import { currentCatalog } from "../catalog/current.mjs";
import { SITE_ORIGIN } from "../platform/client.mjs";
import { errorSummary } from "../updates/signups.mjs";
import { publicReviews, reviewsForOrder, ReviewError, reviewTags, submitReview } from "./reviews.mjs";

const PRIVATE = { "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" };
// Approving, rejecting or editing a review purges the product's tag; if a purge
// ever fails, the CDN copy still expires within ten minutes.
export const REVIEW_CDN_CACHE = "public, durable, s-maxage=600, stale-while-revalidate=60";
const MAX_BODY = 8 * 1024;

export async function handleReviews(request, { db, env, catalog = currentCatalog, purge = (tags) => purgeCache({ tags }) }) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/reviews\/?/, "").replace(/\/$/, "");
  try {
    if (route === "" && request.method === "GET") {
      const slug = url.searchParams.get("product") ?? "";
      return Response.json(await publicReviews(db, slug), { headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": REVIEW_CDN_CACHE,
        "Netlify-Cache-Tag": reviewTags(slug).join(","),
      } });
    }
    if (route === "order" && request.method === "GET") {
      const link = { o: url.searchParams.get("o") ?? "", k: url.searchParams.get("k") ?? "" };
      return Response.json(await reviewsForOrder(db, env, (await catalog()).products, link), { headers: PRIVATE });
    }
    if (route === "order" && request.method === "POST") {
      const origin = new URL(env.get("ACCOUNT_ORIGIN") || SITE_ORIGIN).origin;
      if (request.headers.get("origin") !== origin || request.headers.get("x-aha-review") !== "1") return Response.json({ error: "Request blocked." }, { status: 403, headers: PRIVATE });
      const text = await request.text();
      if (text.length > MAX_BODY) throw new ReviewError("Keep it to 600 characters.", 413);
      let input;
      try { input = JSON.parse(text || "{}"); } catch { throw new ReviewError("Request must be JSON.", 400); }
      const { wasPublic, ...saved } = await submitReview(db, env, (await catalog()).products, input);
      if (wasPublic) await Promise.resolve().then(() => purge(reviewTags(saved.product))).catch(() => {});
      return Response.json(saved, { headers: PRIVATE });
    }
    return Response.json({ error: "Not found." }, { status: 404, headers: PRIVATE });
  } catch (error) {
    if (error instanceof ReviewError) return Response.json({ error: error.message }, { status: error.status, headers: PRIVATE });
    console.error(JSON.stringify({ event: "reviews_api_error", route, error: errorSummary(error) }));
    return Response.json({ error: "Reviews aren't available right now. Try again in a minute." }, { status: 500, headers: PRIVATE });
  }
}
