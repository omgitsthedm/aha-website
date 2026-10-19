// Unsubscribing from customer emails (bag reminders, review requests). Each email
// carries a link signed for its own notification row, so no address ever
// appears in a URL. Unsubscribing stores only a SHA-256 hash of the address,
// stops both emails for good, and removes the address from the email list.
// Order receipts and shipping emails still come for anything the person buys.
import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { SITE_ORIGIN } from "../platform/client.mjs";
import { missingTable } from "../updates/signups.mjs";

const HEADERS = { "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" };

export const emailHash = (email) => createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex");

// Same base secret as order links, separate purpose.
function key(env) {
  const base = env.get("AHA_ORDER_LINK_SECRET") || env.get("AHA_SQUARE_WEBHOOK_SIGNATURE_KEY");
  if (typeof base !== "string" || base.length < 16) return null;
  return Buffer.from(hkdfSync("sha256", base, "aha-email-unsubscribe", "unsubscribe-v1", 32));
}
const sign = (id, secret) => createHmac("sha256", secret).update(String(id)).digest("base64url").slice(0, 32);

/** The page link (shown in the email) and the one-click link (List-Unsubscribe) for a notification row. */
export function unsubscribeLinks(id, env, origin = SITE_ORIGIN) {
  const secret = key(env);
  if (!secret || !/^\d{1,18}$/.test(String(id))) return null;
  const query = `n=${id}&k=${sign(id, secret)}`;
  return { page: `${origin}/unsubscribe/?${query}`, oneClick: `${origin}/api/email/unsubscribe?${query}` };
}

export function verifyUnsubscribe(id, token, env) {
  const secret = key(env);
  if (!secret || !/^\d{1,18}$/.test(String(id ?? "")) || typeof token !== "string") return false;
  const expected = Buffer.from(sign(id, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function isSuppressed(db, email) {
  try {
    const [row] = await db.sql`SELECT 1 AS found FROM aha_email_suppressions WHERE email_sha256 = ${emailHash(email)}`;
    return Boolean(row);
  } catch (error) {
    // Before the migration there are no customer emails to stop either.
    if (missingTable(error)) return false;
    throw error;
  }
}

/** POST from the unsubscribe page (JSON) or a mail app's one-click (RFC 8058 form body). */
export async function handleUnsubscribe(request, { db, env }) {
  if (request.method !== "POST") return Response.json({ error: "Not found." }, { status: 404, headers: HEADERS });
  const url = new URL(request.url);
  let id = url.searchParams.get("n");
  let token = url.searchParams.get("k");
  if (!id || !token) {
    const input = await request.json().catch(() => ({}));
    id = String(input?.n ?? "");
    token = String(input?.k ?? "");
  }
  if (!verifyUnsubscribe(id, token, env)) return Response.json({ error: "This unsubscribe link isn’t valid. Write to info@afterhoursagenda.com and we’ll take you off." }, { status: 404, headers: HEADERS });
  const [row] = await db.sql`SELECT recipient, kind FROM aha_order_notifications WHERE id = ${id}`;
  if (!row) return Response.json({ error: "This unsubscribe link isn’t valid. Write to info@afterhoursagenda.com and we’ll take you off." }, { status: 404, headers: HEADERS });
  await db.sql`INSERT INTO aha_email_suppressions (email_sha256, source) VALUES (${emailHash(row.recipient)}, ${row.kind}) ON CONFLICT (email_sha256) DO NOTHING`;
  await db.sql`DELETE FROM aha_email_signups WHERE email = ${String(row.recipient).trim().toLowerCase()}`.catch((error) => { if (!missingTable(error)) throw error; });
  return Response.json({ unsubscribed: true }, { headers: HEADERS });
}
