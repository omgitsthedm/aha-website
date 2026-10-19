import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { handleReviews } from "../../server/customers/reviews-api.mjs";

// Product reviews: public approved reviews, and the order page's form. Production host only.
export default async function reviews(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  return handleReviews(request, { db: getDatabase(), env: Netlify.env });
}

export const config = { path: ["/api/reviews", "/api/reviews/order"], method: ["GET", "POST"] };
