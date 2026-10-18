import { getDatabase } from "@netlify/database";
import { allowedOrigin, checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { jsonBody, noStore } from "../../server/checkout/http.mjs";

// Opaque, short-lived checkout receipts let a footer opt-out narrow server
// attribution too. The endpoint never accepts customer details or grants data.
export default async function checkoutPrivacy(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "POST") return new Response(null, { status: 404 });
  if (!allowedOrigin(request)) return errorResponse(new CheckoutError("origin_rejected", 403));
  try {
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    return noStore(await runtime.service.privacy(await jsonBody(request)));
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/privacy", method: ["POST"] };
