import { getDatabase } from "@netlify/database";
import { allowedOrigin, checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { publicCheckoutResult } from "../../server/checkout/service.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { jsonBody, noStore } from "../../server/checkout/http.mjs";
import { afterResponse, checkoutProperties, createPostHogCapture, posthogConfig } from "../../server/analytics/posthog.mjs";
import { createMarketingRuntime } from "../../server/analytics/marketing-runtime.mjs";
import { posthogPurchaseAllowed } from "../../server/analytics/marketing.mjs";

async function capturePurchase(runtime, checkoutId) {
  const capture = createPostHogCapture(posthogConfig(Netlify.env));
  const session = await runtime.repository.get(checkoutId);
  if (!session?.posthog_distinct_id || !posthogPurchaseAllowed(session)) return false;
  return capture("purchase_completed", { distinctId: session.posthog_distinct_id, sessionId: session.posthog_session_id }, checkoutProperties({ totalCents: session.total_cents, items: session.cart_json }));
}

export default async function checkoutPay(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "POST") return new Response(null, { status: 404 });
  if (!allowedOrigin(request)) return errorResponse(new CheckoutError("origin_rejected", 403));
  try {
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    const body = await jsonBody(request);
    const result = await runtime.service.pay(body ?? {});
    // A server-confirmed purchase is attributed to the visitor's replay session; it never affects payment.
    if (!result.trackingSuppressed && result.state === "completed" && typeof result.checkoutId === "string") await afterResponse(context, capturePurchase(runtime, result.checkoutId));
    // The provider outbox uses the same confirmed Square order id as the
    // browser Purchase event. A tracking failure is isolated after payment.
    if (!result.trackingSuppressed && result.state === "completed" && typeof result.checkoutId === "string") {
      const marketing = createMarketingRuntime({ database: getDatabase(), env: Netlify.env });
      await afterResponse(context, marketing.queueCheckout(result.checkoutId).then(() => marketing.service.dispatch(2)));
    }
    return noStore(publicCheckoutResult(result), result.state === "pending" ? 202 : 200);
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/pay", method: ["POST"] };
