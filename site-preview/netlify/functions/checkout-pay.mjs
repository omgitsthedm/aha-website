import { getDatabase } from "@netlify/database";
import { allowedOrigin, checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { jsonBody, noStore } from "../../server/checkout/http.mjs";

export default async function checkoutPay(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "POST") return new Response(null, { status: 404 });
  if (!allowedOrigin(request)) return errorResponse(new CheckoutError("origin_rejected", 403));
  try {
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    const body = await jsonBody(request);
    const result = await runtime.service.pay(body ?? {});
    return noStore(result, result.state === "pending" ? 202 : 200);
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/pay", method: ["POST"] };
