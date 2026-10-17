// The private order page (/order/?o=…&k=…): a signed link per order, emailed with
// the confirmation and shipment emails, and a customer-safe view of the order's
// progress from the fulfillment table. It never returns names, emails or addresses.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { SITE_ORIGIN } from "../platform/client.mjs";

// AHA_ORDER_LINK_SECRET if set; otherwise a key derived (HKDF, separate purpose)
// from the Square webhook signature key every production deploy already has.
function linkKey(env) {
  const base = env.get("AHA_ORDER_LINK_SECRET") || env.get("AHA_SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (typeof base !== "string" || base.length < 16) return null;
  return Buffer.from(hkdfSync("sha256", base, "aha-order-link", "order-status-v1", 32));
}

export const orderToken = (orderId, key) => createHmac("sha256", key).update(String(orderId)).digest("base64url").slice(0, 32);

export function orderStatusUrl(orderId, env, origin = SITE_ORIGIN) {
  const key = linkKey(env);
  return key && orderId ? `${origin}/order/?o=${encodeURIComponent(orderId)}&k=${orderToken(orderId, key)}` : null;
}

export function verifyOrderToken(orderId, token, env) {
  const key = linkKey(env);
  if (!key || typeof orderId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(orderId) || typeof token !== "string") return false;
  const expected = Buffer.from(orderToken(orderId, key));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const json = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return fallback; } }
  return value;
};

/** Where the order is, in the customer's words. */
export function stageFor(row) {
  if (!row) return "paid";
  const tracking = json(row.tracking, []);
  if (row.state === "shipped" || tracking.some((entry) => entry?.number || entry?.url)) return "shipped";
  if (String(row.state).startsWith("submitted") || row.apliiq_order_id) return "production";
  if (["held", "attention", "uncertain"].includes(row.state)) return "review";
  return "paid";
}

export function customerView(orderId, row) {
  const items = json(row?.submitted_items, []).map((item) => ({ title: String(item?.title ?? "Your piece"), size: item?.size ? String(item.size) : null, quantity: Number(item?.quantity ?? 1) }));
  const tracking = json(row?.tracking, []).filter((entry) => entry && (entry.number || entry.url)).map((entry) => ({ carrier: entry.carrier ? String(entry.carrier) : null, number: entry.number ? String(entry.number) : null, url: typeof entry.url === "string" && /^https:\/\//.test(entry.url) ? entry.url : null }));
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
  const [row] = await db.sql`SELECT state, apliiq_order_id, apliiq_payload, submitted_items, tracking, payment_created_at, created_at FROM aha_fulfillment_orders WHERE square_order_id = ${orderId}`;
  return reply(customerView(orderId, row));
}
