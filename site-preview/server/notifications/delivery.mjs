import { Webhook } from "svix";
import { webhookBody } from "../fulfillment/http.mjs";

const TYPES = new Set(["sent", "delivered", "delivery_delayed", "bounced", "failed", "suppressed", "complained"]);
const reply = (body, status) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

// Verify before parsing or touching the database. Svix checks the raw body,
// all signed headers and the five-minute replay window. Event IDs deduplicate
// retries; event times preserve delivery order even when callbacks arrive late.
export async function receiveDelivery(request, { secret, database }) {
  if (!secret) return reply({ accepted: false }, 503);
  const raw = await webhookBody(request);
  if (raw === null) return reply({ accepted: false }, 413);
  let event;
  const id = request.headers.get("svix-id");
  try {
    new Webhook(secret).verify(raw, {
      "svix-id": id,
      "svix-timestamp": request.headers.get("svix-timestamp"),
      "svix-signature": request.headers.get("svix-signature"),
    });
  } catch { return reply({ accepted: false }, 403); }
  try { event = JSON.parse(raw); } catch { return reply({ accepted: false }, 400); }
  const type = String(event?.type ?? "").replace(/^email\./, "");
  if (!String(event?.type).startsWith("email.") || !TYPES.has(type)) return reply({ accepted: true, ignored: true }, 202);
  const message = event?.data?.email_id;
  const occurred = Date.parse(event?.created_at ?? "");
  if (typeof id !== "string" || id.length > 200 || typeof message !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(message)
      || !Number.isFinite(occurred) || occurred > Date.now() + 300_000) return reply({ accepted: false }, 400);
  try {
    const db = database();
    await db.sql`INSERT INTO aha_email_delivery_events (event_id, provider_message_id, event_type, occurred_at)
      VALUES (${id}, ${message}, ${type}, ${new Date(occurred).toISOString()}) ON CONFLICT (event_id) DO NOTHING`;
    return reply({ accepted: true }, 202);
  } catch { return reply({ accepted: false }, 503); }
}
