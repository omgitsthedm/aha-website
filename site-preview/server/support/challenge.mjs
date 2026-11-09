import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { SITE_ORIGIN } from "../platform/client.mjs";

export const SUPPORT_CHALLENGE_TTL_MS = 15 * 60 * 1000;
export const SUPPORT_CHALLENGE_MIN_AGE_MS = 3 * 1000;

const headers = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  vary: "Origin",
};

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const challengeKey = (nonce) => hash(`support:challenge:${nonce}`);

function sign(encoded, secret) {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

function validSignature(expected, actual) {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

function parse(token, secret, clientKey, now) {
  if (!secret || typeof token !== "string" || token.length > 600) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || !validSignature(sign(encoded, secret), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const age = now - payload.issuedAt;
    if (
      !payload ||
      typeof payload.nonce !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(payload.nonce) ||
      !Number.isSafeInteger(payload.issuedAt) ||
      typeof payload.binding !== "string" ||
      payload.binding !== hash(`support:client:${clientKey}`) ||
      age < SUPPORT_CHALLENGE_MIN_AGE_MS ||
      age > SUPPORT_CHALLENGE_TTL_MS
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function issueSupportChallenge({ db, secret, clientKey = "unknown", now = Date.now(), nonce = randomUUID() }) {
  if (!secret) return null;
  const payload = {
    nonce,
    issuedAt: now,
    binding: hash(`support:client:${clientKey}`),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  await db.sql`INSERT INTO aha_signup_attempts (client_key) VALUES (${challengeKey(nonce)})`;
  await db.sql`DELETE FROM aha_signup_attempts WHERE attempted_at < now() - interval '1 day'`;
  return {
    token: `${encoded}.${sign(encoded, secret)}`,
    earliestSubmitAt: new Date(now + SUPPORT_CHALLENGE_MIN_AGE_MS).toISOString(),
    expiresAt: new Date(now + SUPPORT_CHALLENGE_TTL_MS).toISOString(),
  };
}

export async function consumeSupportChallenge({ db, secret, token, clientKey = "unknown", now = Date.now() }) {
  const payload = parse(token, secret, clientKey, now);
  if (!payload) return false;
  const [consumed] = await db.sql`
    DELETE FROM aha_signup_attempts
    WHERE client_key = ${challengeKey(payload.nonce)}
      AND attempted_at > now() - interval '15 minutes'
    RETURNING client_key
  `;
  return Boolean(consumed);
}

export async function handleSupportChallenge(request, { db, secret, clientKey = "unknown", now = Date.now() }) {
  if (request.method !== "GET") return reply({ error: "Not found." }, 404);
  const origin = request.headers.get("origin");
  if (request.headers.get("x-aha-support") !== "1" || (origin && origin !== SITE_ORIGIN)) return reply({ error: "Request blocked." }, 403);
  try {
    const challenge = await issueSupportChallenge({ db, secret, clientKey, now });
    if (!challenge) return reply({ error: "Please email us directly while the form is briefly unavailable." }, 503);
    return reply(challenge);
  } catch {
    return reply({ error: "Please email us directly while the form is briefly unavailable." }, 503);
  }
}
