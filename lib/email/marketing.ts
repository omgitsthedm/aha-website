import crypto from "node:crypto";

// Marketing / lifecycle email (abandoned-cart, welcome, review, win-back).
// SEPARATE from transactional order email: it is CAN-SPAM compliant (physical
// address + one-click unsubscribe headers) and only sends when the lifecycle
// gate is ON. Transactional order email is unaffected and always allowed.

interface ResendResponse { id?: string; message?: string; name?: string }

export function isMarketingEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.RESEND_REPLY_TO);
}

/** Master switch. Lifecycle emails send to real customers ONLY when this is "true". */
export function isLifecycleEmailEnabled(): boolean {
  return process.env.LIFECYCLE_EMAIL_ENABLED === "true";
}

function tokenSecret(): string {
  return process.env.LIFECYCLE_SECRET || process.env.CRON_SECRET || "";
}

/** Stable, unguessable unsubscribe/recovery token bound to an email. */
function signEmailToken(email: string): string {
  const secret = tokenSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export function verifyEmailToken(email: string, token: string): boolean {
  const expected = signEmailToken(email);
  if (!expected || !token || expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function siteOrigin(): string {
  // Prefer the explicit canonical; Netlify's URL/req.url can be a deploy URL.
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.URL || "https://afterhoursagenda.com").replace(/\/$/, "");
}

export function unsubscribeUrl(email: string): string {
  const token = signEmailToken(email);
  return `${siteOrigin()}/api/lifecycle/unsubscribe?email=${encodeURIComponent(email)}&t=${token}`;
}

/** Recovery link that rehydrates the saved bag on any device (token-verified). */
export function recoverCartUrl(email: string): string {
  const token = signEmailToken(email);
  return `${siteOrigin()}/cart?recover=1&e=${encodeURIComponent(email)}&t=${token}`;
}

export async function sendMarketingEmail(input: {
  idempotencyKey: string; to: string; subject: string; html: string; text: string; stream: string;
}): Promise<string> {
  if (!isMarketingEmailConfigured()) throw new Error("Marketing email is not configured");
  const listUnsub = unsubscribeUrl(input.to);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [input.to],
      reply_to: process.env.RESEND_REPLY_TO,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: listUnsub
        ? { "List-Unsubscribe": `<${listUnsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
      tags: [{ name: "stream", value: input.stream }],
    }),
  });
  const result = await response.json().catch(() => ({})) as ResendResponse;
  if (!response.ok || !result.id) throw new Error(`Resend ${response.status}: ${result.message || result.name || "send failed"}`);
  return result.id;
}
