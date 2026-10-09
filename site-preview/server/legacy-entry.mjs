import { POST as quote } from "../../app/api/checkout-quote/route.ts";
import { POST as payment } from "../../app/api/create-payment/route.ts";
import { POST as squareWebhook } from "../../app/api/webhooks/square/route.ts";
import { POST as apliiqWebhook } from "../../app/api/webhooks/apliiq/route.ts";
import { POST as printfulWebhook } from "../../app/api/webhooks/printful/route.ts";
import { isCheckoutOpen } from "../../lib/commerce/catalog-policy.ts";
import reconcile from "../../netlify/functions/reconcile-orders.ts";
import dispatch from "../../netlify/functions/dispatch-order-email.ts";
export const legacyCheckoutOpen = isCheckoutOpen;
export async function runLegacy(path, request) {
  const handlers = {
    "/api/checkout-quote": quote,
    "/api/create-payment": payment,
    "/api/webhooks/square": squareWebhook,
    "/api/webhooks/apliiq/fulfillment": apliiqWebhook,
    "/api/webhooks/printful": printfulWebhook,
    reconcile: reconcile,
    dispatch: dispatch,
  };
  return handlers[path]
    ? handlers[path](request)
    : new Response("Not found", { status: 404 });
}
