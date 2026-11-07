// One definition for the new-sale gate and operational checks. Existing payment
// reconciliation stays available when a setting is accidentally switched off.
export function commerceConfiguration(env) {
  const present = (key) => Boolean(env.get(key));
  const enabled = (key) => env.get(key) === "true";
  const checks = {
    checkout_enabled: enabled("AHA_CHECKOUT_ENABLED"),
    square_configured: ["AHA_SQUARE_ACCESS_TOKEN", "AHA_SQUARE_APPLICATION_ID", "AHA_SQUARE_LOCATION_ID", "AHA_SQUARE_MERCHANT_ID", "AHA_SQUARE_WEBHOOK_SIGNATURE_KEY"].every(present),
    fulfillment_enabled: enabled("AHA_FULFILLMENT_ENABLED"),
    supplier_configured: ["AHA_APLIIQ_API_KEY", "AHA_APLIIQ_SHARED_SECRET"].every(present)
      && Number.isFinite(Date.parse(env.get("AHA_FULFILLMENT_START_AT") ?? "")),
    receipts_enabled: enabled("AHA_ORDER_EMAIL_ENABLED"),
    receipts_configured: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_REPLY_TO"].every(present),
  };
  return { acceptingOrders: Object.values(checks).every(Boolean), checks };
}
