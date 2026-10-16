import { getDatabase } from "@netlify/database";
import { allowedOrigin, checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { jsonBody, noStore } from "../../server/checkout/http.mjs";
import { afterResponse, checkoutProperties, createPostHogCapture, posthogConfig } from "../../server/analytics/posthog.mjs";
import { currentCatalog } from "../../server/catalog/current.mjs";

export default async function checkoutQuote(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "POST") return new Response(null, { status: 404 });
  if (!allowedOrigin(request)) return errorResponse(new CheckoutError("origin_rejected", 403));
  try {
    const { allowList } = await currentCatalog();
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env, catalog: allowList });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    const body = await jsonBody(request);
    const quote = await runtime.service.quote({ items: body?.items, shippingAddress: body?.shippingAddress, analytics: body?.analytics });
    // Analytics never delays or fails a quote.
    await afterResponse(context, createPostHogCapture(posthogConfig(Netlify.env))("checkout_quoted", body?.analytics, checkoutProperties({ totalCents: quote.totalAmount, items: quote.lineItems })));
    return noStore(quote);
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/quote", method: ["POST"] };
