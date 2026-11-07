// The private order page (/order/?o=…&k=…): a signed link per order, emailed with
// the confirmation and shipment emails, and a customer-safe view of the order's
// progress from the fulfillment table. It never returns names, emails or addresses.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { AHA_FULFILLMENT_CATALOG } from "../fulfillment/catalog.mjs";
import { SITE_ORIGIN } from "../platform/client.mjs";

// AHA_ORDER_LINK_SECRET if set; otherwise a key derived (HKDF, separate purpose)
// from the Square webhook signature key every production deploy already has.
function deriveKey(base) {
  if (typeof base !== "string" || base.length < 16) return null;
  return Buffer.from(hkdfSync("sha256", base, "aha-order-link", "order-status-v1", 32));
}

function linkKey(env) { return deriveKey(env.get("AHA_ORDER_LINK_SECRET") || env.get("AHA_SQUARE_WEBHOOK_SIGNATURE_KEY")); }

export const orderToken = (orderId, key) => createHmac("sha256", key).update(String(orderId)).digest("base64url").slice(0, 32);

export function orderStatusUrl(orderId, env, origin = SITE_ORIGIN) {
  const key = linkKey(env);
  return key && orderId ? `${origin}/order/?o=${encodeURIComponent(orderId)}&k=${orderToken(orderId, key)}` : null;
}

export function verifyOrderToken(orderId, token, env) {
  const key = linkKey(env);
  if (!key || typeof orderId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(orderId) || typeof token !== "string") return false;
  let previous = [];
  try { previous = JSON.parse(env.get("AHA_ORDER_LINK_PREVIOUS_SECRETS") || "[]"); } catch { /* invalid rotation settings fail closed */ }
  const keys = [key, deriveKey(env.get("AHA_SQUARE_WEBHOOK_SIGNATURE_KEY")), ...(Array.isArray(previous) ? previous.slice(0, 3).map(deriveKey).filter(Boolean) : [])].filter(Boolean);
  const given = Buffer.from(token);
  return keys.some((candidate) => { const expected = Buffer.from(orderToken(orderId, candidate)); return given.length === expected.length && timingSafeEqual(given, expected); });
}

const json = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return fallback; } }
  return value;
};

// Fulfillment persists trackingNumber/trackingUrl. Older account fixtures and
// historical records use number/url; expose one customer-facing shape for both.
const trackingFor = (row) => json(row?.tracking, []).filter((entry) => entry && typeof entry === "object").map((entry) => ({
  carrier: entry.carrier, number: entry.trackingNumber ?? entry.number, url: entry.trackingUrl ?? entry.url,
}));

/** Where the order is, in the customer's words. */
export function stageFor(row) {
  if (!row) return "paid";
  if (row.refund_state === "refunded") return "refunded";
  if (row.cancellation_state === "cancelled") return "cancelled";
  if (["held", "attention", "uncertain"].includes(row.state) || row.dispute_state === "open" || ["partial", "pending", "failed"].includes(row.refund_state)) return "review";
  if (row.delivered_at && row.state === "shipped") return "delivered";
  if (row.state === "shipped") return "shipped";
  if (["shipped_partial", "ready_to_ship"].includes(row.state)) return "partial";
  if (String(row.provider_status).toLowerCase() === "in production") return "creating";
  if (String(row.provider_status).toLowerCase() === "ready to ship") return "ready";
  if (String(row.state).startsWith("submitted") || row.apliiq_order_id) return "production";
  return "paid";
}

export function customerView(orderId, row) {
  const items = json(row?.submitted_items, []).map((item) => ({ title: String(item?.title ?? AHA_FULFILLMENT_CATALOG[item?.variationId]?.title ?? "Your piece"), size: item?.size ? String(item.size) : null, quantity: Number(item?.quantity ?? 1) }));
  const tracking = trackingFor(row).filter((entry) => entry.number || entry.url).map((entry) => ({ carrier: entry.carrier ? String(entry.carrier) : null, number: entry.number ? String(entry.number) : null, url: typeof entry.url === "string" && /^https:\/\//.test(entry.url) ? entry.url : null }));
  const paidAt = row?.payment_created_at ?? row?.created_at ?? null;
  return {
    orderNumber: String(json(row?.apliiq_payload, {})?.order_number ?? orderId),
    stage: stageFor(row),
    paidAt: paidAt ? new Date(paidAt).toISOString() : null,
    items,
    tracking,
  };
}

const HEADERS = { "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" };
const reply = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

export async function handleOrderStatus(request, { db, env }) {
  if (request.method !== "GET") return reply({ error: "Not found." }, 404);
  const url = new URL(request.url);
  const orderId = url.searchParams.get("o") ?? "";
  // A wrong link and an unknown order look the same.
  if (!verifyOrderToken(orderId, url.searchParams.get("k"), env)) return reply({ error: "We couldn't find that order. Use the link in your order email." }, 404);
  let [row] = await db.sql`SELECT f.state, f.provider_status, f.delivered_at, f.apliiq_order_id, f.apliiq_payload, f.submitted_items, f.tracking, f.payment_created_at, f.created_at,
    m.refund_state, m.dispute_state, m.cancellation_state FROM aha_fulfillment_orders f
    LEFT JOIN aha_order_financials m USING(square_order_id) WHERE f.square_order_id = ${orderId}`;
  if (!row) {
    const [paid] = await db.sql`SELECT c.cart_json, c.order_payload_json, c.updated_at,m.refund_state,m.dispute_state,m.cancellation_state FROM aha_checkout_sessions c LEFT JOIN aha_order_financials m USING(square_order_id) WHERE c.square_order_id = ${orderId} AND c.state = 'completed' LIMIT 1`;
    if (paid) row = { ...paid, state: "paid", apliiq_payload: { order_number: json(paid.order_payload_json, {}).reference_id }, payment_created_at: paid.updated_at, submitted_items: json(paid.cart_json, []).map((item) => ({ title: item.title ?? AHA_FULFILLMENT_CATALOG[item.variationId]?.title ?? "Your piece", size: item.size, quantity: item.quantity })) };
  }
  if (!row) return reply({ error: "We couldn’t find that order." }, 404);
  return reply(customerView(orderId, row));
}
