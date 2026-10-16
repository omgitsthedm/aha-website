// Email sign-ups from the storefront. Collects addresses only: nothing is sent
// to the visitor and no email provider is called. Every accepted request gets
// the same reply, so the form never reveals whether an address is already on
// the list. The admin lists, exports and removes them (server/admin/api.mjs).
import { createHash } from "node:crypto";
import { SITE_ORIGIN } from "../platform/client.mjs";

/** Shown beside every sign-up form and stored with each address. */
export const SIGNUP_CONSENT = "New pieces and the occasional note. We never sell or share your address.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;
const SOURCE = /^[a-z0-9-]{1,40}$/;
const MAX_BODY = 2048;
const ATTEMPTS_PER_HOUR = 8;
const HEADERS = { "cache-control": "no-store" };
const reply = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length >= 6 && email.length <= 254 && EMAIL.test(email) ? email : null;
}

// Until a deploy has applied the sign-up migration the tables don't exist. Read
// paths treat that as an empty list so the admin overview and the weekly digest
// keep working; a sign-up gets a plain "couldn't save" reply.
const missingTable = (error) => error?.code === "42P01" || /relation "aha_(email_signups|signup_attempts)" does not exist/.test(String(error?.message ?? ""));

const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

export async function handleSubscribe(request, { db, clientKey = "unknown", origin = SITE_ORIGIN }) {
  if (request.method !== "POST") return reply({ error: "Not found." }, 404);
  // Only this site's own form, sent by its script.
  if (request.headers.get("origin") !== origin) return reply({ error: "Request blocked." }, 403);
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return reply({ error: "Request must be JSON." }, 415);
  const text = await request.text();
  if (text.length > MAX_BODY) return reply({ error: "Request too large." }, 413);
  let input;
  try { input = JSON.parse(text); } catch { return reply({ error: "Request must be JSON." }, 400); }
  if (!input || typeof input !== "object") return reply({ error: "Request must be JSON." }, 400);
  // The hidden field only automated form fillers complete: accept, store nothing.
  if (typeof input.company === "string" && input.company.trim()) return reply({ ok: true });
  const email = normalizeEmail(input.email);
  if (!email) return reply({ error: "Enter a full email address, like name@example.com." }, 422);
  const source = typeof input.source === "string" && SOURCE.test(input.source) ? input.source : "site";

  const key = hash(clientKey);
  try {
    const [row] = await db.sql`SELECT count(*) AS attempts FROM aha_signup_attempts WHERE client_key = ${key} AND attempted_at > now() - interval '1 hour'`;
    if (Number(row?.attempts ?? 0) >= ATTEMPTS_PER_HOUR) return reply({ error: "Too many tries from this connection. Try again in an hour." }, 429);
    await db.sql`INSERT INTO aha_signup_attempts (client_key) VALUES (${key})`;
    await db.sql`DELETE FROM aha_signup_attempts WHERE attempted_at < now() - interval '1 day'`;
    await db.sql`INSERT INTO aha_email_signups (email, source, consent_text) VALUES (${email}, ${source}, ${SIGNUP_CONSENT}) ON CONFLICT (email) DO NOTHING`;
  } catch (error) {
    // Nothing was stored; say so plainly. The daily health check reports the missing table.
    if (missingTable(error)) return reply({ error: SIGNUP_UNAVAILABLE }, 503);
    throw error;
  }
  return reply({ ok: true });
}

export const SIGNUP_UNAVAILABLE = "We couldn't save your address just now. Please try again later, or follow @afterhoursagenda on Instagram.";

/** Daily health: the sign-up tables exist on this database. */
export async function signupProblems(db) {
  const [row] = await db.sql`SELECT to_regclass('aha_email_signups') IS NOT NULL AS signups, to_regclass('aha_signup_attempts') IS NOT NULL AS attempts`;
  return row?.signups && row?.attempts ? [] : ["Email sign-ups can't be saved: the sign-up tables don't exist on the production database yet (migration 20261016140000_email_signups hasn't been applied by a Netlify deploy)."];
}


/** Total addresses and those added in the last seven days. */
export async function signupCounts(db) {
  try {
    const [counts] = await db.sql`SELECT count(*) AS total, count(*) FILTER (WHERE created_at > now() - interval '7 days') AS week FROM aha_email_signups`;
    return { total: Number(counts?.total ?? 0), last7Days: Number(counts?.week ?? 0) };
  } catch (error) {
    if (missingTable(error)) return { total: 0, last7Days: 0 };
    throw error;
  }
}

/** Admin: every address, newest first. */
export async function listSignups(db, { limit = 5000 } = {}) {
  let rows;
  try {
    rows = await db.sql`SELECT id, email, source, created_at FROM aha_email_signups ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  } catch (error) {
    if (missingTable(error)) return { total: 0, last7Days: 0, signups: [] };
    throw error;
  }
  return {
    ...await signupCounts(db),
    signups: rows.map((row) => ({ id: String(row.id), email: row.email, source: row.source, createdAt: new Date(row.created_at).toISOString() })),
  };
}

/** Admin: remove one address (a removal request). Returns false if it was already gone. */
export async function removeSignup(db, id) {
  if (!/^\d{1,18}$/.test(String(id))) return false;
  const rows = await db.sql`DELETE FROM aha_email_signups WHERE id = ${Number(id)} RETURNING id`;
  return rows.length > 0;
}
