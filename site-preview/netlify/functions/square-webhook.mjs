import { getDatabase } from "@netlify/database";
import { sha256, verifySquareSignature } from "../../server/fulfillment/crypto.mjs";
import { createRuntime, AHA_HOST, requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { dispatchAfterResponse } from "../../server/notifications/dispatch-after.mjs";

const PATH = "/api/webhooks/square";
const json = (value, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });

export default async function squareWebhook(request, context) {
  if (!requireProductionRequest(request, context)) return json({ accepted: false }, 404);
  if (request.method !== "POST") return json({ accepted: false }, 405);
  const rawBody = await request.text();
  const runtime = createRuntime({ database: getDatabase(), env: Netlify.env });
  const signature = request.headers.get("x-square-hmacsha256-signature");
  if (!verifySquareSignature({
    canonicalUrl: `https://${AHA_HOST}${PATH}`,
    rawBody,
    signature,
    signatureKey: runtime.config.squareSignatureKey,
  })) return json({ accepted: false }, 403);
  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ accepted: false }, 400); }
  if (!runtime.config.merchantId) return json({ accepted: false }, 503);
  if (event.merchant_id !== runtime.config.merchantId) return json({ accepted: false }, 403);
  if (!["payment.created", "payment.updated"].includes(event.type)) return json({ accepted: true, ignored: true }, 202);
  const paymentId = event.data?.object?.payment?.id;
  const eventId = event.event_id;
  if (typeof paymentId !== "string" || !paymentId || typeof eventId !== "string" || !eventId) return json({ accepted: false }, 400);
  try {
    // This durable inbox is written after signature+merchant validation and
    // before any Square/Apliiq outbound call. A later scheduled run can drain
    // an event whose provider retry budget expires during an outage.
    await runtime.repository.ingestSquareEvent({ eventId, paymentId, eventCreatedAt: event.created_at ?? null });
    const result = await runtime.service.processSquareEvent(eventId);
    if (result.outcome !== "duplicate") await dispatchAfterResponse(runtime.notifications, context);
    return json({ accepted: true, outcome: result.outcome }, 202);
  } catch {
    // Return retryable failure without order or customer data. Square can send
    // the same event again; durable order state prevents duplicate supplier POSTs.
    return json({ accepted: false, event: sha256(rawBody).slice(0, 12) }, 503);
  }
}

export const config = { path: "/api/webhooks/square", method: ["POST"] };
