import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { handleOrderStatus } from "../../server/orders/status.mjs";
import { errorSummary } from "../../server/updates/signups.mjs";

// The private order page's data. Production host only; a signed link is required.
export default async function orderStatus(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  try {
    return await handleOrderStatus(request, { db: getDatabase(), env: Netlify.env });
  } catch (error) {
    console.error(JSON.stringify({ event: "order_status_error", error: errorSummary(error) }));
    return Response.json({ error: "Your order status isn't available right now. Try again in a minute." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export const config = { path: "/api/orders/status", method: ["GET"] };
