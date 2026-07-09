import { createHmac, timingSafeEqual } from "crypto";

interface VerifyPrintfulWebhookOptions {
  rawBody: string;
  signature: string | null;
  secretKeyHex: string | undefined;
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyPrintfulWebhookSignature({
  rawBody,
  signature,
  secretKeyHex,
}: VerifyPrintfulWebhookOptions): boolean {
  if (!rawBody || !signature || !secretKeyHex) {
    return false;
  }

  const secret = Buffer.from(secretKeyHex, "hex");
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return safeEqualHex(expected, signature);
}

