import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, isDbConfigured } from "@/lib/db/client";
import { loginTokens } from "@/db/schema";

// Passwordless magic-link auth. Optional feature — guest checkout is unchanged.
// No passwords stored; sessions are stateless HMAC-signed cookies.
export const ACCOUNT_COOKIE = "aha_account";
const TOKEN_TTL_MS = 20 * 60 * 1000;               // magic link valid 20 min
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // session 30 days

function secret(): string {
  return process.env.LIFECYCLE_SECRET || process.env.CRON_SECRET || "";
}
export function isAccountsConfigured(): boolean {
  return isDbConfigured() && Boolean(secret());
}

export async function createLoginToken(email: string): Promise<string | null> {
  if (!isAccountsConfigured()) return null;
  const token = crypto.randomBytes(32).toString("hex");
  try {
    await db().insert(loginTokens).values({
      token, email: email.trim().toLowerCase(), expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });
    return token;
  } catch { return null; }
}

/** Validate + single-use consume a magic-link token, returning its email. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  if (!isDbConfigured() || !token) return null;
  try {
    const [row] = await db().select().from(loginTokens).where(eq(loginTokens.token, token)).limit(1);
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
    await db().update(loginTokens).set({ usedAt: new Date() }).where(eq(loginTokens.id, row.id));
    return row.email;
  } catch { return null; }
}

export function signSession(email: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email.trim().toLowerCase(), x: Date.now() + SESSION_TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(cookie?: string | null): string | null {
  if (!cookie || !secret()) return null;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof e !== "string" || typeof x !== "number" || x < Date.now()) return null;
    return e;
  } catch { return null; }
}

export const SESSION_MAX_AGE = SESSION_TTL_MS / 1000;
