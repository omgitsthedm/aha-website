import { getDatabase } from "@netlify/database";
import { verifySecret } from "../../server/fulfillment/crypto.mjs";
import { AHA_SITE_ID, createRuntime, requireProductionRequest } from "../../server/fulfillment/runtime.mjs";

export default async function notificationHealth(request, context) {
  if (!requireProductionRequest(request, context) || context?.site?.id !== AHA_SITE_ID || request.method !== "GET") return new Response(null, { status: 404 });
  const fulfillment = createRuntime({ database: getDatabase(), env: Netlify.env });
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!verifySecret(fulfillment.config.adminToken, supplied)) return new Response(null, { status: 401, headers: { "www-authenticate": "Bearer" } });
  const status = await fulfillment.notifications.service.health();
  const states = await fulfillment.notifications.repository.counts();
  return Response.json({ ...status, states }, { headers: { "cache-control": "no-store" } });
}
export const config = { path: "/api/notifications/health", method: ["GET"] };
