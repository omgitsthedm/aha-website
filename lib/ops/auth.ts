import { createHmac, timingSafeEqual } from "node:crypto";

export const OPS_COOKIE = "aha_ops_session";

function secret(): string {
  return process.env.AHA_OPS_SESSION_SECRET || "";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createOpsSessionToken(): string {
  if (!secret()) throw new Error("AHA_OPS_SESSION_SECRET is not configured.");
  return createHmac("sha256", secret()).update("after-hours-agenda:ops:v1").digest("base64url");
}

export function verifyOpsSessionToken(value: string | undefined): boolean {
  if (!value || !secret()) return false;
  return safeEqual(value, createOpsSessionToken());
}

export function verifyOpsPassword(value: string): boolean {
  const expected = process.env.AHA_OPS_PASSWORD || "";
  return Boolean(expected) && safeEqual(value, expected);
}
