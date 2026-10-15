import { getDatabase } from "@netlify/database";
import { verifySecret } from "../../server/fulfillment/crypto.mjs";
import { AHA_SITE_ID, createRuntime, requireProductionRequest } from "../../server/fulfillment/runtime.mjs";

export default async function fulfillmentHealth(request, context) {
  if (!requireProductionRequest(request, context) || context?.site?.id !== AHA_SITE_ID || request.method !== "GET") return new Response(null, { status: 404 });
  const runtime = createRuntime({ database: getDatabase(), env: Netlify.env });
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!verifySecret(runtime.config.adminToken, supplied)) return new Response(null, { status: 401, headers: { "www-authenticate": "Bearer" } });
  const counts = await runtime.repository.counts();
  const attention = await runtime.repository.attentionRows();
  return Response.json({
    enabled: runtime.config.enabled === "true",
    activationConfigured: Boolean(runtime.config.startAt),
    squareConfigured: Boolean(Netlify.env.get("AHA_SQUARE_ACCESS_TOKEN")),
    apliiqConfigured: Boolean(Netlify.env.get("AHA_APLIIQ_API_KEY") && runtime.config.apliiqSharedSecret),
    states: counts,
    attention,
  }, { headers: { "cache-control": "no-store" } });
}

export const config = { path: "/api/fulfillment/health", method: ["GET"] };
