// Orders for the admin: Square order, Apliiq status and tracking side by side,
// with plain-language flags for anything that needs a person. Only a first
// name and city are shown; no email or street address leaves the database.

const ATTENTION_STATES = new Set(["held", "attention", "uncertain"]);
const SHIPPED_STATES = new Set(["shipped"]);
const STUCK_HOURS = 48;

const json = (value) => (typeof value === "string" ? JSON.parse(value) : value ?? null);

export function orderFlags(order, now = Date.now()) {
  const flags = [];
  const ageHours = (now - new Date(order.created_at).getTime()) / 3_600_000;
  if (ATTENTION_STATES.has(order.state)) flags.push({ code: order.state, message: order.state === "uncertain" ? "Apliiq didn't confirm this order. Check the Apliiq dashboard before anything else; never resubmit blindly." : "Held for review. Open the order in Square and Apliiq." });
  if (order.last_error_code && !ATTENTION_STATES.has(order.state)) flags.push({ code: "error", message: `Last problem: ${order.last_error_code}.` });
  if (!SHIPPED_STATES.has(order.state) && ageHours > STUCK_HOURS) flags.push({ code: "stuck", message: `Not shipped after ${Math.floor(ageHours)} hours.` });
  if (order.provider_status === "changed") flags.push({ code: "changed", message: "The Square order changed or was refunded before it reached Apliiq; it was held, not sent." });
  return flags;
}

export async function listOrders(db, { limit = 100 } = {}) {
  const rows = await db.sql`
    SELECT o.square_order_id, o.state, o.provider_status, o.apliiq_order_id, o.submitted_items, o.tracking, o.last_error_code,
           o.created_at, o.updated_at,
           s.total_cents, s.shipping_address_json->>'firstName' AS first_name, s.shipping_address_json->>'city' AS city,
           s.shipping_address_json->>'region' AS region
    FROM aha_fulfillment_orders o
    LEFT JOIN aha_checkout_sessions s ON s.square_order_id = o.square_order_id
    ORDER BY o.created_at DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 500)}`;
  const now = Date.now();
  return rows.map((row) => ({
    squareOrderId: row.square_order_id,
    state: row.state,
    providerStatus: row.provider_status ?? null,
    apliiqOrderId: row.apliiq_order_id ?? null,
    customer: [row.first_name, [row.city, row.region].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || null,
    totalCents: row.total_cents === null || row.total_cents === undefined ? null : Number(row.total_cents),
    items: (json(row.submitted_items) ?? []).map((item) => ({ title: item.title ?? item.product ?? item.sku, size: item.size ?? null, quantity: Number(item.quantity ?? 1) })),
    tracking: (json(row.tracking) ?? []).map((entry) => ({ carrier: entry.carrier ?? null, number: entry.trackingNumber ?? entry.number ?? null, url: entry.trackingUrl ?? entry.url ?? null })),
    createdAt: new Date(row.created_at).toISOString(),
    flags: orderFlags(row, now),
  }));
}

export async function overview(db) {
  const [orders] = await db.sql`
    SELECT count(*) FILTER (WHERE created_at > now() - interval '1 day') AS today,
           count(*) FILTER (WHERE created_at > now() - interval '7 days') AS week,
           count(*) FILTER (WHERE state IN ('held', 'attention', 'uncertain') OR (state <> 'shipped' AND created_at < now() - interval '48 hours')) AS attention
    FROM aha_fulfillment_orders`;
  const [drafts] = await db.sql`SELECT count(*) FILTER (WHERE status = 'draft') AS waiting, count(*) FILTER (WHERE status = 'approved') AS approved FROM aha_product_drafts`;
  return {
    ordersToday: Number(orders?.today ?? 0),
    ordersThisWeek: Number(orders?.week ?? 0),
    ordersNeedingAttention: Number(orders?.attention ?? 0),
    draftsWaiting: Number(drafts?.waiting ?? 0),
    draftsApproved: Number(drafts?.approved ?? 0),
  };
}
