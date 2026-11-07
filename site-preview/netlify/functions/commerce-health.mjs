import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { verifySecret } from "../../server/fulfillment/crypto.mjs";
import { commerceHealth } from "../../server/operations/commerce.mjs";

export default async function health(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  if (request.method !== "GET") return new Response(null, { status: 405 });
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!verifySecret(Netlify.env.get("AHA_COMMERCE_MONITOR_TOKEN"), supplied)) return new Response(null, { status: 401 });
  try {
    const result = await commerceHealth({ db: getDatabase(), env: Netlify.env });
    return Response.json(result, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, problems: [{ code: "commerce_check_unavailable", count: 1 }] }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
export const config = { path: "/api/commerce/health", method: ["GET"] };
