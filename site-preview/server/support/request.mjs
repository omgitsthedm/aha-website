import { createHash } from "node:crypto";
import { boundedText } from "../http/body.mjs";
import { CLIENT, SITE_ORIGIN } from "../platform/client.mjs";
import { normalizeEmail, errorSummary } from "../updates/signups.mjs";

const TOPICS = { order: "Existing order", product: "Product or fit", returns: "Exchange or refund", accessibility: "Accessibility", general: "General question" };
const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
const reply = (data, status = 200) => Response.json(data, { status, headers });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const escape = (value) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fallback = `We couldn’t confirm receipt. Your message is still here. Try again or email ${CLIENT.client.email}.`;

// Bounded JSON reader: never buffer an arbitrary public request or log its contents.
async function readInput(request) {
  let text;
  try { text = await boundedText(request, 8192); }
  catch (error) {
    if (error instanceof Error && error.message === "request_size") return null;
    throw error;
  }
  return JSON.parse(text);
}

export async function handleSupport(request, { db, gateway, clientKey = "unknown", origin = SITE_ORIGIN }) {
  if (request.method !== "POST") return reply({ error: "Not found." }, 404);
  if (request.headers.get("origin") !== origin || request.headers.get("x-aha-support") !== "1") return reply({ error: "Request blocked." }, 403);
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return reply({ error: "Request must be JSON." }, 415);
  let input;
  try { input = await readInput(request); } catch { return reply({ error: "Please check your message and try again." }, 400); }
  if (input === null) return reply({ error: "Your message is too long." }, 413);
  if (!input || typeof input !== "object" || Array.isArray(input)) return reply({ error: "Please check your message." }, 400);
  if (typeof input.company === "string" && input.company.trim()) return reply({ ok: true });
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = normalizeEmail(input.email);
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const reference = typeof input.reference === "string" ? input.reference.trim() : "";
  if (name.length < 2 || name.length > 80 || !email || email.length > 160 || message.length < 10 || message.length > 1800 || reference.length > 120) return reply({ error: "Check your name, email and message. Your details are still here." }, 422);
  if (typeof input.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.requestId)) return reply({ error: "Refresh this page before sending." }, 422);
  if (!gateway) return reply({ error: fallback }, 503);
  const topic = Object.hasOwn(TOPICS, input.topic) ? TOPICS[input.topic] : TOPICS.general;
  const text = `${topic}\n\n${message}\n\nName: ${name}\nReply to: ${email}\nOrder number: ${reference || "Not provided"}\n`;
  try {
    // Reuse the existing ephemeral attempt table; namespaced hashes contain no raw IP or email.
    for (const value of [`support:ip:${clientKey}`, `support:email:${email}`]) {
      const key = hash(value);
      const [row] = await db.sql`SELECT count(*) AS attempts FROM aha_signup_attempts WHERE client_key = ${key} AND attempted_at > now() - interval '1 hour'`;
      if (Number(row?.attempts ?? 0) >= 5) return reply({ error: `Please wait before trying again, or email ${CLIENT.client.email}.` }, 429);
      await db.sql`INSERT INTO aha_signup_attempts (client_key) VALUES (${key})`;
    }
    await db.sql`DELETE FROM aha_signup_attempts WHERE attempted_at < now() - interval '1 day'`;
    const sent = await gateway.send({
      idempotencyKey: `support-${hash(`${input.requestId}\n${text}`)}`,
      recipient: CLIENT.client.email,
      // `email` is normalized and validated above; transactional messages keep
      // the configured brand reply address by omitting this override.
      replyTo: email,
      subject: `Website support: ${topic}`,
      text, html: `<pre style="white-space:pre-wrap;font-family:system-ui">${escape(text)}</pre>`,
    });
    if (!sent?.id) throw new Error("support_not_acknowledged");
    return reply({ ok: true });
  } catch (error) {
    console.error(JSON.stringify({ event: "support_delivery_error", error: errorSummary(error) }));
    return reply({ error: fallback }, 503);
  }
}
