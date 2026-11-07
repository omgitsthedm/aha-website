import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { receiveDelivery } from "../../server/notifications/delivery.mjs";

export default async function resendWebhook(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  if (request.method !== "POST") return new Response(null, { status: 405 });
  return receiveDelivery(request, { secret: Netlify.env.get("RESEND_WEBHOOK_SECRET"), database: getDatabase });
}
export const config = { path: "/api/webhooks/resend", method: ["POST"] };
