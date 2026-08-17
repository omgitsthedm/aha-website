import { safeEqualBase64, signApliiqFulfillmentPayload } from "./auth";
import {
  isSecureTrackingUrl,
  normalizeApliiqFulfillmentStatus,
  normalizeApliiqStringList,
} from "./orders";
import type {
  ApliiqFulfillmentWebhookPayload,
  NormalizedApliiqTracking,
} from "./types";

export interface VerifyApliiqFulfillmentWebhookOptions {
  /** Exact, unparsed UTF-8 body received by the route handler. */
  rawBody: string;
  signature: string | null;
  sharedSecret: string | undefined;
}

/**
 * Apliiq sends x-apliiq-hmac = Base64(HMAC-SHA256(Base64(raw body), secret)).
 * Verification intentionally happens before JSON parsing.
 */
export function verifyApliiqFulfillmentWebhookSignature({
  rawBody,
  signature,
  sharedSecret,
}: VerifyApliiqFulfillmentWebhookOptions): boolean {
  if (!signature || !sharedSecret) return false;
  try {
    return safeEqualBase64(signApliiqFulfillmentPayload(rawBody, sharedSecret), signature.trim());
  } catch {
    return false;
  }
}

/**
 * Extract only explicit, safe tracking details. An arbitrary webhook status or
 * a tracking number alone never upgrades an order to shipped.
 */
export function normalizeApliiqFulfillmentWebhook(
  payload: ApliiqFulfillmentWebhookPayload
): NormalizedApliiqTracking {
  const fulfillment = payload.fulfillment;
  if (!fulfillment) {
    return { status: "unknown", trackingNumbers: [], trackingUrls: [] };
  }
  const carrier = fulfillment.tracking_company?.trim();
  return {
    status: normalizeApliiqFulfillmentStatus(fulfillment.status),
    ...(carrier ? { carrier } : {}),
    trackingNumbers: normalizeApliiqStringList(fulfillment.tracking_numbers),
    trackingUrls: normalizeApliiqStringList(fulfillment.tracking_urls, isSecureTrackingUrl),
  };
}
