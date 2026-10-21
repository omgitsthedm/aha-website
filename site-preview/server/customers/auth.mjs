// Customer accounts sign in with passkeys only. Nothing identifies the person:
// no password, name or email address is asked for or stored, only each
// passkey's public key. Sessions are random tokens stored only as SHA-256 hashes.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { SITE_ORIGIN } from "../platform/client.mjs";

export const ACCOUNT_COOKIE = "__Host-aha_account";
const SESSION_DAYS = 90;
const CHALLENGE_MINUTES = 5;
// The browser prompt gives up before the stored challenge expires.
const PROMPT_TIMEOUT_MS = 4 * 60_000;
const ATTEMPT_WINDOW_MINUTES = 15;
const ATTEMPT_LIMIT = 30;

export class AccountError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const fromB64url = (value) => new Uint8Array(Buffer.from(value, "base64url"));

export function accountRelyingParty(env) {
  const url = new URL(env.get("ACCOUNT_ORIGIN") || SITE_ORIGIN);
  return { rpID: url.hostname, rpName: "After Hours Agenda", origin: url.origin };
}

export function readAccountToken(request) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === ACCOUNT_COOKIE) return value.join("=") || null;
  }
  return null;
}

export const accountCookie = (token) => `${ACCOUNT_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
export const clearedAccountCookie = () => `${ACCOUNT_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;

/** The signed-in customer's id, or null. Cheap enough for checkout to ask. */
export async function accountFor(request, db) {
  const token = readAccountToken(request);
  if (!token || token.length > 100) return null;
  const [row] = await db.sql`SELECT customer_id FROM aha_customer_sessions WHERE token_sha256 = ${hash(token)} AND expires_at > now() LIMIT 1`;
  return row?.customer_id ?? null;
}

export function createAccountAuth({ db, env, now = () => new Date() }) {
  const rp = accountRelyingParty(env);

  async function throttle(clientKey) {
    const key = hash(String(clientKey ?? "unknown"));
    await db.sql`DELETE FROM aha_customer_attempts WHERE client_key = ${key} AND attempted_at < now() - interval '1 day'`;
    const [row] = await db.sql`SELECT count(*) AS attempts FROM aha_customer_attempts WHERE client_key = ${key} AND attempted_at > now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES})`;
    if (Number(row?.attempts ?? 0) >= ATTEMPT_LIMIT) throw new AccountError("Too many tries. Wait fifteen minutes and try again.", 429);
    await db.sql`INSERT INTO aha_customer_attempts (client_key) VALUES (${key})`;
  }

  async function saveChallenge(challenge, purpose) {
    await db.sql`DELETE FROM aha_customer_challenges WHERE expires_at < now()`;
    const handle = randomBytes(24).toString("base64url");
    const expires = new Date(now().getTime() + CHALLENGE_MINUTES * 60_000).toISOString();
    await db.sql`INSERT INTO aha_customer_challenges (id_sha256, challenge, purpose, expires_at) VALUES (${hash(handle)}, ${challenge}, ${purpose}, ${expires})`;
    return handle;
  }

  async function takeChallenge(handle, purpose) {
    if (typeof handle !== "string" || !handle || handle.length > 100) throw new AccountError("That took too long. Try again.");
    const [row] = await db.sql`DELETE FROM aha_customer_challenges WHERE id_sha256 = ${hash(handle)} AND purpose = ${purpose} RETURNING *`;
    if (!row || new Date(row.expires_at).getTime() < now().getTime()) throw new AccountError("That took too long. Try again.");
    return row;
  }

  async function startSession(customerId) {
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(now().getTime() + SESSION_DAYS * 86400_000).toISOString();
    await db.sql`DELETE FROM aha_customer_sessions WHERE customer_id = ${customerId} AND expires_at < now()`;
    await db.sql`INSERT INTO aha_customer_sessions (token_sha256, customer_id, expires_at) VALUES (${hash(token)}, ${customerId}, ${expires})`;
    await db.sql`UPDATE aha_customers SET last_seen_at = now() WHERE id = ${customerId}`;
    return token;
  }

  async function endSession(request) {
    const token = readAccountToken(request);
    if (token) await db.sql`DELETE FROM aha_customer_sessions WHERE token_sha256 = ${hash(token)}`;
  }

  async function registrationOptions({ clientKey }) {
    await throttle(clientKey);
    const label = `After Hours Agenda ${randomBytes(3).toString("hex").toUpperCase()}`;
    const options = await generateRegistrationOptions({
      rpName: rp.rpName, rpID: rp.rpID, userName: label, userDisplayName: label,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      timeout: PROMPT_TIMEOUT_MS,
    });
    return { options, handle: await saveChallenge(options.challenge, "register") };
  }

  async function registrationVerify({ handle, response, clientKey }) {
    await throttle(clientKey);
    const challenge = await takeChallenge(handle, "register");
    let result;
    try {
      result = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true });
    } catch { throw new AccountError("Your passkey couldn't be checked. Try again."); }
    if (!result.verified) throw new AccountError("Your passkey couldn't be checked. Try again.");
    const { credential } = result.registrationInfo;
    const customerId = `cus_${randomUUID()}`;
    await db.sql`INSERT INTO aha_customers (id) VALUES (${customerId})`;
    await db.sql`INSERT INTO aha_customer_credentials (id, customer_id, public_key, counter, transports) VALUES (${credential.id}, ${customerId}, ${b64url(credential.publicKey)}, ${credential.counter}, ${credential.transports ?? []})`;
    return { customerId, token: await startSession(customerId) };
  }

  async function loginOptions({ clientKey }) {
    await throttle(clientKey);
    const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required", timeout: PROMPT_TIMEOUT_MS });
    return { options, handle: await saveChallenge(options.challenge, "login") };
  }

  async function loginVerify({ handle, response, clientKey, expectedCustomerId, issueSession = true }) {
    await throttle(clientKey);
    const challenge = await takeChallenge(handle, "login");
    const [stored] = await db.sql`SELECT * FROM aha_customer_credentials WHERE id = ${String(response?.id ?? "").slice(0, 1024)} LIMIT 1`;
    if (!stored) throw new AccountError("That passkey isn't linked to an account here. Create an account instead.");
    if (expectedCustomerId && stored.customer_id !== expectedCustomerId) throw new AccountError("Use a passkey for the account you’re signed into.");
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response, expectedChallenge: challenge.challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true,
        credential: { id: stored.id, publicKey: fromB64url(stored.public_key), counter: Number(stored.counter), transports: stored.transports ?? [] },
      });
    } catch { throw new AccountError("Your passkey couldn't be checked. Try again."); }
    if (!result.verified) throw new AccountError("Your passkey couldn't be checked. Try again.");
    await db.sql`UPDATE aha_customer_credentials SET counter = ${result.authenticationInfo.newCounter}, last_used_at = now() WHERE id = ${stored.id}`;
    return { customerId: stored.customer_id, ...(issueSession ? { token: await startSession(stored.customer_id) } : {}) };
  }

  async function backupOptions({ customerId, handle, response, clientKey }) {
    // A cookie alone cannot enroll a permanent credential: prove possession first.
    await loginVerify({ handle, response, clientKey, expectedCustomerId: customerId, issueSession: false });
    const credentials = await db.sql`SELECT id, transports FROM aha_customer_credentials WHERE customer_id = ${customerId}`;
    if (credentials.length >= 5) throw new AccountError("Five passkeys are already saved for this account.", 422);
    const options = await generateRegistrationOptions({
      rpName: rp.rpName, rpID: rp.rpID, userName: `After Hours Agenda ${customerId.slice(-6)}`, userDisplayName: "After Hours Agenda",
      userID: new Uint8Array(Buffer.from(customerId)), attestationType: "none",
      excludeCredentials: credentials.map(({ id, transports }) => ({ id, transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" }, timeout: PROMPT_TIMEOUT_MS,
    });
    // Bind the single-use challenge to the signed-in account without a new schema.
    const bound = JSON.stringify({ challenge: options.challenge, customerId });
    return { options, handle: await saveChallenge(bound, "register") };
  }

  async function backupVerify({ customerId, handle, response, clientKey }) {
    await throttle(clientKey);
    const saved = await takeChallenge(handle, "register");
    let bound;
    try { bound = JSON.parse(saved.challenge); } catch { throw new AccountError("Start again from Add a backup passkey."); }
    if (bound.customerId !== customerId || typeof bound.challenge !== "string") throw new AccountError("Start again from your own account.");
    const [count] = await db.sql`SELECT count(*) AS total FROM aha_customer_credentials WHERE customer_id = ${customerId}`;
    if (Number(count?.total ?? 0) >= 5) throw new AccountError("Five passkeys are already saved for this account.", 422);
    let result;
    try {
      result = await verifyRegistrationResponse({ response, expectedChallenge: bound.challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: true });
    } catch { throw new AccountError("Your new passkey couldn’t be checked. Try again."); }
    if (!result.verified) throw new AccountError("Your new passkey couldn’t be checked. Try again.");
    const { credential } = result.registrationInfo;
    const inserted = await db.sql`INSERT INTO aha_customer_credentials (id, customer_id, public_key, counter, transports) VALUES (${credential.id}, ${customerId}, ${b64url(credential.publicKey)}, ${credential.counter}, ${credential.transports ?? []}) ON CONFLICT (id) DO NOTHING RETURNING id`;
    if (!inserted.length) throw new AccountError("That passkey is already saved. Choose another device or password manager.", 409);
    return { ok: true };
  }

  return { endSession, registrationOptions, registrationVerify, loginOptions, loginVerify, backupOptions, backupVerify };
}
