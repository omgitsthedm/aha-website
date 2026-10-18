import { getDatabase } from "@netlify/database";
import { checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { noStore } from "../../server/checkout/http.mjs";
import { afterResponse } from "../../server/analytics/posthog.mjs";
import { createMarketingRuntime } from "../../server/analytics/marketing-runtime.mjs";

export default async function checkoutStatus(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "GET") return new Response(null, { status: 404 });
  try {
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    const url = new URL(request.url);
    const result = await runtime.service.status({ checkoutId: url.searchParams.get("checkoutId"), checkoutToken: url.searchParams.get("checkoutToken") });
    if (result.state === "completed" && typeof result.checkoutId === "string") {
      const marketing = createMarketingRuntime({ database: getDatabase(), env: Netlify.env });
      await afterResponse(context, marketing.queueCheckout(result.checkoutId).then(() => marketing.service.dispatch(2)));
    }
    return noStore(result);
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/status", method: ["GET"] };
