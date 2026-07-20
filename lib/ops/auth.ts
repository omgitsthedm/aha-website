import { createHmac, timingSafeEqual } from "node:crypto";

export const OPS_COOKIE = "aha_ops_session";
/** Ops session lifetime — the token embeds this expiry AND the cookie mirrors it. */
export const OPS_SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours (seconds)

function secret(): string {
  return process.env.AHA_OPS_SESSION_SECRET || "";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Signed session token that carries its own expiry: `v2.<expMs>.<sig>`. Because
 * the expiry is inside the signed payload, a copied cookie stops working after
 * OPS_SESSION_MAX_AGE even if the cookie's own maxAge is stripped — the previous
 * static HMAC never expired until the secret rotated.
 */
export function createOpsSessionToken(): string {
  if (!secret()) throw new Error("AHA_OPS_SESSION_SECRET is not configured.");
  const exp = Date.now() + OPS_SESSION_MAX_AGE * 1000;
  const payload = `after-hours-agenda:ops:v2:${exp}`;
  return `v2.${exp}.${sign(payload)}`;
}

export function verifyOpsSessionToken(value: string | undefined): boolean {
  if (!value || !secret()) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v2") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false; // expired or malformed
  const expected = sign(`after-hours-agenda:ops:v2:${exp}`);
  return safeEqual(parts[2], expected);
}

export function verifyOpsPassword(value: string): boolean {
  const expected = process.env.AHA_OPS_PASSWORD || "";
  return Boolean(expected) && safeEqual(value, expected);
}
