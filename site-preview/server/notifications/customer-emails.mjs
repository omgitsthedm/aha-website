// The two customer emails the owner approved on October 19, 2026, queued by the
// hourly notification run (netlify/functions/notification-dispatch.mjs):
//
// - Bag reminder: one email, three hours after a checkout was quoted and not
//   paid. Only when the shopper's marketing choice was on at checkout, nothing
//   was bought since, no reminder went to that address in 30 days, and the
//   address hasn't unsubscribed. Checkouts older than three days are left alone.
// - Review request: one email per order, ten days after its shipping email.
//
// Neither covers anything from before the program started (aha_email_programs),
// and AHA_CUSTOMER_EMAILS_ENABLED=false turns both off.
import { SITE_ORIGIN } from "../platform/client.mjs";
import { missingTable } from "../updates/signups.mjs";
import { emailHash } from "./unsubscribe.mjs";

export const CART_REMINDER_DELAY_HOURS = 3;
export const REVIEW_REQUEST_DELAY_DAYS = 10;

export const customerEmailsEnabled = (env) => env.get("AHA_CUSTOMER_EMAILS_ENABLED") !== "false";

export async function cartReminderCandidates(db, limit = 20) {
  return db.sql`
    WITH program AS (SELECT started_at FROM aha_email_programs WHERE name = 'cart_reminder'),
    latest AS (
      SELECT DISTINCT ON (lower(s.shipping_address_json->>'email'))
             s.checkout_id, lower(s.shipping_address_json->>'email') AS email, s.shipping_address_json->>'firstName' AS first_name,
             s.cart_json, s.marketing_json, s.created_at
      FROM aha_checkout_sessions s, program
      WHERE s.state = 'quoted'
        AND s.created_at > program.started_at
        AND s.created_at < now() - make_interval(hours => ${CART_REMINDER_DELAY_HOURS})
        AND s.created_at > now() - interval '3 days'
      ORDER BY lower(s.shipping_address_json->>'email'), s.created_at DESC
    )
    SELECT l.* FROM latest l
    WHERE l.marketing_json->'marketing'->>'consent' = 'true'
      AND NOT EXISTS (SELECT 1 FROM aha_checkout_sessions c WHERE lower(c.shipping_address_json->>'email') = l.email AND c.state <> 'quoted' AND c.created_at > l.created_at - interval '1 day')
      AND NOT EXISTS (SELECT 1 FROM aha_fulfillment_orders f WHERE lower(f.customer_email) = l.email AND f.created_at > l.created_at - interval '1 day')
      AND NOT EXISTS (SELECT 1 FROM aha_order_notifications n WHERE n.recipient = l.email AND n.kind = 'cart_reminder' AND n.created_at > now() - interval '30 days')
      AND NOT EXISTS (SELECT 1 FROM aha_email_suppressions x WHERE x.email_sha256 = encode(sha256(convert_to(l.email, 'UTF8')), 'hex'))
    ORDER BY l.created_at
    LIMIT ${limit}`;
}

export async function reviewRequestCandidates(db, limit = 20) {
  return db.sql`
    WITH program AS (SELECT started_at FROM aha_email_programs WHERE name = 'review_request')
    SELECT DISTINCT ON (f.square_order_id)
           f.square_order_id, lower(f.customer_email) AS email, f.apliiq_payload->>'order_number' AS order_number
    FROM aha_order_notifications n
    JOIN aha_fulfillment_orders f ON f.square_order_id = split_part(n.dedupe_key, ':', 1)
    CROSS JOIN program
    WHERE n.kind = 'order_shipped' AND n.state = 'sent'
      AND n.sent_at > program.started_at
      AND n.sent_at < now() - make_interval(days => ${REVIEW_REQUEST_DELAY_DAYS})
      AND f.customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
      AND NOT EXISTS (SELECT 1 FROM aha_order_notifications r WHERE r.dedupe_key = f.square_order_id || ':review_request')
      AND NOT EXISTS (SELECT 1 FROM aha_reviews v WHERE v.square_order_id = f.square_order_id)
      AND NOT EXISTS (SELECT 1 FROM aha_email_suppressions x WHERE x.email_sha256 = encode(sha256(convert_to(lower(f.customer_email), 'UTF8')), 'hex'))
    ORDER BY f.square_order_id, n.sent_at
    LIMIT ${limit}`;
}

const json = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === "string") { try { return JSON.parse(value); } catch { return fallback; } }
  return value;
};

/** The bag's lines in words, and a link that puts them back in the bag on any device. */
export function bagFromCart(cart, products, origin = SITE_ORIGIN) {
  const variants = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.id, { product, variant }])));
  const lines = json(cart, []).flatMap((line) => {
    const found = variants.get(line?.variationId);
    const quantity = Math.min(Math.max(Number(line?.quantity) || 1, 1), 10);
    return found ? [{ variationId: found.variant.id, quantity, title: `${found.product.title} — ${found.product.color}`, size: found.variant.size }] : [];
  });
  return { items: lines.map(({ title, size, quantity }) => ({ title, size, quantity })), bagUrl: `${origin}/checkout/?bag=${lines.map((line) => `${line.variationId}:${line.quantity}`).join(",")}` };
}

/** Right before sending: is a queued customer email still wanted? (No purchase or review since.) */
export async function stillDue(db, row) {
  const [subject] = String(row?.dedupe_key ?? "").split(":");
  if (row?.kind === "cart_reminder") {
    const [bought] = await db.sql`
      SELECT 1 AS found FROM aha_checkout_sessions s
      WHERE s.checkout_id = ${subject} AND (
        EXISTS (SELECT 1 FROM aha_checkout_sessions c WHERE lower(c.shipping_address_json->>'email') = lower(s.shipping_address_json->>'email') AND c.state <> 'quoted' AND c.created_at > s.created_at - interval '1 day')
        OR EXISTS (SELECT 1 FROM aha_fulfillment_orders f WHERE lower(f.customer_email) = lower(s.shipping_address_json->>'email') AND f.created_at > s.created_at - interval '1 day'))`;
    return !bought;
  }
  if (row?.kind === "review_request") {
    const [reviewed] = await db.sql`SELECT 1 AS found FROM aha_reviews WHERE square_order_id = ${subject} LIMIT 1`;
    return !reviewed;
  }
  return true;
}

/** Queue whatever is due. Safe to run every hour: each email has a unique dedupe key. */
export async function queueCustomerEmails({ db, service, products, env }) {
  if (!customerEmailsEnabled(env)) return { enabled: false, cartReminders: 0, reviewRequests: 0 };
  let cartReminders = 0;
  let reviewRequests = 0;
  try {
    for (const row of await cartReminderCandidates(db)) {
      const bag = bagFromCart(row.cart_json, products);
      if (!bag.items.length) continue;
      if (await service.enqueueCartReminder({ recipient: row.email, checkoutId: row.checkout_id, firstName: row.first_name, ...bag })) cartReminders += 1;
    }
    for (const row of await reviewRequestCandidates(db)) {
      if (await service.enqueueReviewRequest({ recipient: row.email, orderId: row.square_order_id, orderNumber: row.order_number })) reviewRequests += 1;
    }
  } catch (error) {
    // Before the migration is applied there is nothing to queue.
    if (missingTable(error)) return { enabled: true, cartReminders, reviewRequests, waitingForMigration: true };
    throw error;
  }
  return { enabled: true, cartReminders, reviewRequests };
}

export { emailHash };
