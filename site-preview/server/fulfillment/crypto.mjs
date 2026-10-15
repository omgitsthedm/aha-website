import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function equalBase64(expected, received) {
  if (typeof received !== "string" || !received.trim()) return false;
  try {
    const a = Buffer.from(expected, "base64");
    const b = Buffer.from(received.trim(), "base64");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Square signs the exact public notification URL concatenated with raw body. */
export function verifySquareSignature({ canonicalUrl, rawBody, signature, signatureKey }) {
  if (!canonicalUrl || !rawBody || !signatureKey) return false;
  const expected = createHmac("sha256", signatureKey)
    .update(`${canonicalUrl}${rawBody}`, "utf8")
    .digest("base64");
  return equalBase64(expected, signature);
}

/** Apliiq signs Base64(raw body), before parsing. */
export function verifyApliiqSignature({ rawBody, signature, sharedSecret }) {
  if (!rawBody || !sharedSecret) return false;
  const expected = createHmac("sha256", sharedSecret)
    .update(Buffer.from(rawBody, "utf8").toString("base64"), "utf8")
    .digest("base64");
  return equalBase64(expected, signature);
}

export function verifySecret(expected, received) {
  if (!expected || !received) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
