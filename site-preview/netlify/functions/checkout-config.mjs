import { checkoutConfig, checkoutReady, requireProductionRequest } from "../../server/checkout/runtime.mjs";

export default async function checkoutConfigHandler(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "GET") return new Response(null, { status: 404 });
  const config = checkoutConfig(Netlify.env);
  if (!checkoutReady(config)) return Response.json({ error: "checkout_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  return Response.json({ appId: config.applicationId, applicationId: config.applicationId, locationId: config.locationId, countryCode: "US", currencyCode: "USD", methods: config.methods }, { headers: { "cache-control": "no-store" } });
}
export const config = { path: "/api/checkout/config", method: ["GET"] };
