import {
  DEFAULT_SITE_URL,
  getCommerceEnvironment,
  getEnvPresence,
  getFulfillmentMode,
  normalizeSiteUrl,
} from "./runtime";

export const CHECKOUT_REQUIRED_ENV = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_LOCATION_ID",
  "NEXT_PUBLIC_SITE_URL",
] as const;

export const SQUARE_CUTOVER_ENV = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_APPLICATION_ID",
  "SQUARE_ENVIRONMENT",
  "SQUARE_API_VERSION",
  "SQUARE_LOCATION_ID",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_WEBHOOK_NOTIFICATION_URL",
] as const;

export const PRINTFUL_CUTOVER_ENV = [
  "PRINTFUL_API_TOKEN",
  "PRINTFUL_STORE_ID",
  "PRINTFUL_WEBHOOK_SECRET_KEY",
  "PRINTFUL_WEBHOOK_PUBLIC_KEY",
] as const;

export const NETLIFY_CUTOVER_ENV = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SQUARE_APP_ID",
  "AHA_FULFILLMENT_MODE",
  "AHA_READINESS_TOKEN",
] as const;

export const ALL_CUTOVER_ENV = [
  ...SQUARE_CUTOVER_ENV,
  ...PRINTFUL_CUTOVER_ENV,
  ...NETLIFY_CUTOVER_ENV,
] as const;

function missingFrom(presence: Record<string, boolean>): string[] {
  return Object.entries(presence)
    .filter(([, configured]) => !configured)
    .map(([name]) => name);
}

export function getCommerceReadinessSnapshot() {
  const checkout = getEnvPresence([...CHECKOUT_REQUIRED_ENV]);
  const square = getEnvPresence([...SQUARE_CUTOVER_ENV]);
  const printful = getEnvPresence([...PRINTFUL_CUTOVER_ENV]);
  const netlify = getEnvPresence([...NETLIFY_CUTOVER_ENV]);
  const all = getEnvPresence([...ALL_CUTOVER_ENV]);
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const squareWebhookUrl = normalizeSiteUrl(
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL
  );

  const warnings: string[] = [];
  if (!siteUrl) {
    warnings.push(
      `NEXT_PUBLIC_SITE_URL is missing or invalid; checkout will fall back to ${DEFAULT_SITE_URL}.`
    );
  }
  if (!squareWebhookUrl) {
    warnings.push(
      "SQUARE_WEBHOOK_NOTIFICATION_URL is missing or invalid; Square webhook signatures cannot be verified safely."
    );
  }
  if (getFulfillmentMode() === "auto") {
    warnings.push(
      "AHA_FULFILLMENT_MODE=auto is not wired to auto-confirm Printful orders yet; keep manual or dry-run until fulfillment is explicitly approved."
    );
  }

  return {
    environment: getCommerceEnvironment(),
    fulfillmentMode: getFulfillmentMode(),
    siteUrlConfigured: Boolean(siteUrl),
    squareWebhookUrlConfigured: Boolean(squareWebhookUrl),
    groups: {
      checkout: {
        configured: checkout,
        missing: missingFrom(checkout),
      },
      square: {
        configured: square,
        missing: missingFrom(square),
      },
      printful: {
        configured: printful,
        missing: missingFrom(printful),
      },
      netlify: {
        configured: netlify,
        missing: missingFrom(netlify),
      },
    },
    missing: missingFrom(all),
    warnings,
  };
}

