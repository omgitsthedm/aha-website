import { createHmac, timingSafeEqual } from "node:crypto";

import type { ApliiqCredentials } from "./types";

export interface ApliiqAuthorizationInput extends ApliiqCredentials {
  /** Unix timestamp in whole seconds. */
  timestamp: number;
  /** Random, unique per request state value. */
  nonce: string;
  /** Exact UTF-8 request body sent over the wire, or an empty string for GET. */
  rawBody?: string;
}

function requireNonEmpty(value: string, label: string): string {
  if (!value.trim()) throw new Error(`Apliiq ${label} is required.`);
  return value;
}

/**
 * Apliiq request signing contract:
 * Base64(HMAC-SHA256(apiKey + RTS + STATE + Base64(requestBody), sharedSecret)).
 * The secret is used as the provided UTF-8 shared secret, not transmitted.
 */
export function createApliiqAuthorization({
  apiKey,
  sharedSecret,
  timestamp,
  nonce,
  rawBody = "",
}: ApliiqAuthorizationInput): string {
  requireNonEmpty(apiKey, "API key");
  requireNonEmpty(sharedSecret, "shared secret");
  requireNonEmpty(nonce, "nonce");
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error("Apliiq timestamp must be a positive Unix-second integer.");
  }

  const payload = Buffer.from(rawBody, "utf8").toString("base64");
  const valueToSign = `${apiKey}${timestamp}${nonce}${payload}`;
  const signature = createHmac("sha256", sharedSecret)
    .update(valueToSign, "utf8")
    .digest("base64");

  return `x-apliiq-auth ${timestamp}:${signature}:${apiKey}:${nonce}`;
}

/**
 * The fulfillment webhook signs the Base64 of the unparsed request body. Do
 * not JSON.parse/stringify before verification: even semantically identical
 * JSON can produce a different signature.
 */
export function signApliiqFulfillmentPayload(
  rawBody: string,
  sharedSecret: string
): string {
  requireNonEmpty(sharedSecret, "shared secret");
  const encodedPayload = Buffer.from(rawBody, "utf8").toString("base64");
  return createHmac("sha256", sharedSecret)
    .update(encodedPayload, "utf8")
    .digest("base64");
}

export function safeEqualBase64(expected: string, received: string): boolean {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(received)) {
    return false;
  }
  const expectedBytes = Buffer.from(expected, "base64");
  const receivedBytes = Buffer.from(received, "base64");
  return expectedBytes.length === receivedBytes.length
    && timingSafeEqual(expectedBytes, receivedBytes);
}
