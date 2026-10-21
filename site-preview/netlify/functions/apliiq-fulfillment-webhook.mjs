import { getDatabase } from "@netlify/database";
import { sha256, verifyApliiqSignature } from "../../server/fulfillment/crypto.mjs";
import { createRuntime, environmentConfig, requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { dispatchAfterResponse } from "../../server/notifications/dispatch-after.mjs";
import { currentCatalog } from "../../server/catalog/current.mjs";
import { webhookBody } from "../../server/fulfillment/http.mjs";

const json = (value, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });

export default async function apliiqFulfillmentWebhook(request, context) {
  if (!requireProductionRequest(request, context)) return json({ accepted: false }, 404);
  if (request.method !== "POST") return json({ accepted: false }, 405);
  const rawBody = await webhookBody(request);
  if (rawBody === null) return json({ accepted: false }, 413);
  const config = environmentConfig(Netlify.env);
  if (!verifyApliiqSignature({ rawBody, signature: request.headers.get("x-apliiq-hmac"), sharedSecret: config.apliiqSharedSecret })) {
    return json({ accepted: false }, 403);
  }
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return json({ accepted: false }, 400); }
  const providerOrderId = payload.fulfillment?.order_id;
  if (providerOrderId === undefined || providerOrderId === null) return json({ accepted: false }, 400);
  try {
    const runtime = createRuntime({ database: getDatabase(), env: Netlify.env, catalog: (await currentCatalog()).allowList });
    const eventId = sha256(rawBody);
    await runtime.repository.ingestProviderEvent({ eventId, squareOrderId: String(providerOrderId) });
    const result = await runtime.service.processApliiqEvent({ providerOrderId, eventId, callbackStatus: payload.fulfillment?.status });
    await dispatchAfterResponse(runtime.notifications, context);
    return json({ accepted: true, outcome: result.outcome }, 202);
  } catch {
    return json({ accepted: false }, 503);
  }
}

export const config = { path: "/api/webhooks/apliiq/fulfillment", method: ["POST"] };
