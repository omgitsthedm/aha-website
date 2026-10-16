// Passkey sign-in for the private admin. No passwords exist: the first passkey
// needs the one-time ADMIN_BOOTSTRAP_TOKEN, later passkeys need a signed-in
// session. Sessions are random tokens stored only as SHA-256 hashes.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { SITE_ORIGIN } from "../platform/client.mjs";

export const SESSION_COOKIE = "__Host-aha_admin";
const SESSION_HOURS = 12;
const CHALLENGE_MINUTES = 5;
// The browser prompt gives up before the stored challenge expires.
const PROMPT_TIMEOUT_MS = 4 * 60_000;
const ATTEMPT_WINDOW_MINUTES = 15;
const ATTEMPT_LIMIT = 30;

export class AdminAuthError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const fromB64url = (value) => new Uint8Array(Buffer.from(value, "base64url"));

export function sameSecret(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || expected.length < 24) return false;
  return timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(expected).digest());
}

export function relyingParty(env) {
  const origin = env.get("ADMIN_ORIGIN") || SITE_ORIGIN;
  const url = new URL(origin);
  return { rpID: url.hostname, rpName: "After Hours Agenda admin", origin: url.origin };
}

export function readSessionToken(request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=");
  }
  return null;
}

export const sessionCookie = (token) => `${SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
export const clearedCookie = () => `${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;

export function createAdminAuth({ db, env, now = () => new Date() }) {
  const rp = relyingParty(env);

  async function audit(userId, action, target = null, detail = {}) {
    await db.sql`INSERT INTO aha_admin_audit (user_id, action, target, detail_json) VALUES (${userId}, ${action}, ${target}, ${JSON.stringify(detail)})`;
  }

  async function throttle(clientKey) {
    const key = hash(String(clientKey ?? "unknown"));
    const [row] = await db.sql`SELECT count(*) AS attempts FROM aha_admin_attempts WHERE client_key = ${key} AND attempted_at > now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES})`;
    if (Number(row?.attempts ?? 0) >= ATTEMPT_LIMIT) throw new AdminAuthError("Too many sign-in attempts. Wait fifteen minutes.", 429);
    await db.sql`INSERT INTO aha_admin_attempts (client_key) VALUES (${key})`;
  }

  async function saveChallenge({ challenge, purpose, userId = null, email = null }) {
    const handle = randomBytes(24).toString("base64url");
    const expires = new Date(now().getTime() + CHALLENGE_MINUTES * 60_000).toISOString();
    await db.sql`INSERT INTO aha_admin_challenges (id_sha256, challenge, purpose, user_id, email, expires_at) VALUES (${hash(handle)}, ${challenge}, ${purpose}, ${userId}, ${email}, ${expires})`;
    return handle;
  }

  async function takeChallenge(handle, purpose) {
    if (typeof handle !== "string" || !handle) throw new AdminAuthError("Sign-in expired. Try again.");
    const [row] = await db.sql`DELETE FROM aha_admin_challenges WHERE id_sha256 = ${hash(handle)} AND purpose = ${purpose} RETURNING *`;
    if (!row || new Date(row.expires_at).getTime() < now().getTime()) throw new AdminAuthError("Sign-in expired. Try again.");
    return row;
  }

  async function startSession(userId) {
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(now().getTime() + SESSION_HOURS * 3600_000).toISOString();
    await db.sql`INSERT INTO aha_admin_sessions (token_sha256, user_id, expires_at) VALUES (${hash(token)}, ${userId}, ${expires})`;
    return token;
  }

  async function sessionUser(request) {
    const token = readSessionToken(request);
    if (!token) return null;
    const [row] = await db.sql`
      SELECT u.id, u.email, u.name FROM aha_admin_sessions s JOIN aha_admin_users u ON u.id = s.user_id
      WHERE s.token_sha256 = ${hash(token)} AND s.expires_at > now() LIMIT 1`;
    return row ?? null;
  }

  async function endSession(request) {
    const token = readSessionToken(request);
    if (token) await db.sql`DELETE FROM aha_admin_sessions WHERE token_sha256 = ${hash(token)}`;
  }

  async function registrationOptions({ request, bootstrapToken, email, clientKey }) {
    await throttle(clientKey);
    const current = await sessionUser(request);
    const [{ users }] = await db.sql`SELECT count(*) AS users FROM aha_admin_users`;
    const userId = current?.id ?? null;
    let userEmail = current?.email ?? null;
    if (!current) {
      if (Number(users) > 0) throw new AdminAuthError("Sign in first to add another passkey.", 403);
      if (!sameSecret(bootstrapToken, env.get("ADMIN_BOOTSTRAP_TOKEN"))) throw new AdminAuthError("The setup code is not valid.", 403);
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminAuthError("Enter a valid email.", 422);
      userEmail = email.trim().toLowerCase();
    }
    const existing = userId ? await db.sql`SELECT id, transports FROM aha_admin_credentials WHERE user_id = ${userId}` : [];
    const options = await generateRegistrationOptions({
      rpName: rp.rpName, rpID: rp.rpID, userName: userEmail, userDisplayName: userEmail,
      userID: userId ? new TextEncoder().encode(userId) : undefined,
      attestationType: "none",
      excludeCredentials: existing.map((row) => ({ id: row.id, transports: row.transports ?? [] })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      timeout: PROMPT_TIMEOUT_MS,
    });
    const handle = await saveChallenge({ challenge: options.challenge, purpose: "register", userId, email: userEmail });
    return { options, handle };
  }

  async function registrationVerify({ handle, response, clientKey }) {
    await throttle(clientKey);
    const challenge = await takeChallenge(handle, "register");
    const result = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true });
    if (!result.verified) throw new AdminAuthError("Passkey could not be verified.");
    let userId = challenge.user_id;
    if (!userId) {
      const [{ users }] = await db.sql`SELECT count(*) AS users FROM aha_admin_users`;
      if (Number(users) > 0) throw new AdminAuthError("Setup was already completed.", 403);
      userId = `adm_${randomUUID()}`;
      await db.sql`INSERT INTO aha_admin_users (id, email) VALUES (${userId}, ${challenge.email})`;
    }
    const { credential } = result.registrationInfo;
    await db.sql`INSERT INTO aha_admin_credentials (id, user_id, public_key, counter, transports) VALUES (${credential.id}, ${userId}, ${b64url(credential.publicKey)}, ${credential.counter}, ${credential.transports ?? []})`;
    await audit(userId, "passkey.registered", credential.id);
    return startSession(userId);
  }

  async function loginOptions({ clientKey }) {
    await throttle(clientKey);
    const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required", timeout: PROMPT_TIMEOUT_MS });
    const handle = await saveChallenge({ challenge: options.challenge, purpose: "login" });
    return { options, handle };
  }

  async function loginVerify({ handle, response, clientKey }) {
    await throttle(clientKey);
    const challenge = await takeChallenge(handle, "login");
    const [stored] = await db.sql`SELECT * FROM aha_admin_credentials WHERE id = ${String(response?.id ?? "")} LIMIT 1`;
    if (!stored) throw new AdminAuthError("This passkey is not registered.");
    const result = await verifyAuthenticationResponse({
      response, expectedChallenge: challenge.challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true,
      credential: { id: stored.id, publicKey: fromB64url(stored.public_key), counter: Number(stored.counter), transports: stored.transports ?? [] },
    });
    if (!result.verified) throw new AdminAuthError("Passkey could not be verified.");
    await db.sql`UPDATE aha_admin_credentials SET counter = ${result.authenticationInfo.newCounter}, last_used_at = now() WHERE id = ${stored.id}`;
    await audit(stored.user_id, "session.started");
    return startSession(stored.user_id);
  }

  return { audit, sessionUser, endSession, registrationOptions, registrationVerify, loginOptions, loginVerify };
}
