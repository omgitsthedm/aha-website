import {
  DEFAULT_SITE_URL,
  getCommerceEnvironment,
  getEnvPresence,
  getFulfillmentMode,
  normalizeSiteUrl,
} from "./runtime";

const CHECKOUT_REQUIRED_ENV = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_LOCATION_ID",
  "NEXT_PUBLIC_SITE_URL",
] as const;

const SQUARE_CUTOVER_ENV = [
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_APPLICATION_ID",
  "SQUARE_ENVIRONMENT",
  "SQUARE_API_VERSION",
  "SQUARE_LOCATION_ID",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_WEBHOOK_NOTIFICATION_URL",
] as const;

const PRINTFUL_CUTOVER_ENV = [
  "PRINTFUL_API_TOKEN",
  "PRINTFUL_STORE_ID",
  "PRINTFUL_WEBHOOK_SECRET_KEY",
  "PRINTFUL_WEBHOOK_PUBLIC_KEY",
] as const;

const NETLIFY_CUTOVER_ENV = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SQUARE_APP_ID",
  "AHA_FULFILLMENT_MODE",
  "AHA_READINESS_TOKEN",
] as const;

const EMAIL_CUTOVER_ENV = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_REPLY_TO",
  "ORDER_SUPPORT_EMAIL",
] as const;

const ALL_CUTOVER_ENV = [
  ...SQUARE_CUTOVER_ENV,
  ...PRINTFUL_CUTOVER_ENV,
  ...NETLIFY_CUTOVER_ENV,
  ...EMAIL_CUTOVER_ENV,
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
  const email = getEnvPresence([...EMAIL_CUTOVER_ENV]);
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
  const fulfillmentMode = getFulfillmentMode();
  const allowPrintfulConfirm = process.env.PRINTFUL_ALLOW_CONFIRM_ORDERS === "true";
  const printfulLiveMode = process.env.PRINTFUL_LIVE_MODE === "true";
  if (fulfillmentMode === "auto" && (!allowPrintfulConfirm || !printfulLiveMode)) {
    warnings.push(
      "AHA_FULFILLMENT_MODE=auto is selected, but one or both Printful confirmation flags are off; paid orders will remain drafts."
    );
  }
  if (fulfillmentMode !== "auto" && allowPrintfulConfirm && printfulLiveMode) {
    warnings.push(
      "Printful confirmation flags are on, but AHA_FULFILLMENT_MODE is not auto; confirmation remains safely disabled."
    );
  }

  return {
    environment: getCommerceEnvironment(),
    fulfillmentMode,
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
      email: {
        configured: email,
        missing: missingFrom(email),
      },
    },
    missing: missingFrom(all),
    warnings,
  };
}
