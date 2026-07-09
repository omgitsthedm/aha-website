import { createHmac, timingSafeEqual } from "crypto";

interface VerifySquareWebhookOptions {
  rawBody: string;
  signature: string | null;
  signatureKey: string | undefined;
  notificationUrl: string | undefined;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifySquareWebhookSignature({
  rawBody,
  signature,
  signatureKey,
  notificationUrl,
}: VerifySquareWebhookOptions): boolean {
  if (!rawBody || !signature || !signatureKey || !notificationUrl) {
    return false;
  }

  const expected = createHmac("sha256", signatureKey)
    .update(`${notificationUrl}${rawBody}`)
    .digest("base64");

  return safeEqual(expected, signature);
}

export function normalizeSquareWebhookEnvironment(
  value: string | null
): "production" | "sandbox" | null {
  const normalized = value?.toLowerCase();
  if (normalized === "production") return "production";
  if (normalized === "sandbox") return "sandbox";
  return null;
}

