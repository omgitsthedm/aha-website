import { getDatabase } from "@netlify/database";
import { checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { noStore } from "../../server/checkout/http.mjs";

export default async function checkoutStatus(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "GET") return new Response(null, { status: 404 });
  try {
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    const url = new URL(request.url);
    return noStore(await runtime.service.status({ checkoutId: url.searchParams.get("checkoutId"), checkoutToken: url.searchParams.get("checkoutToken") }));
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/status", method: ["GET"] };
