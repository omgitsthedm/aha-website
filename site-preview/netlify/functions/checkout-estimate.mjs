import { getDatabase } from "@netlify/database";
import { allowedOrigin, checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { jsonBody, noStore } from "../../server/checkout/http.mjs";
import { currentCatalog } from "../../server/catalog/current.mjs";
import { earlyAccessLocks } from "../../server/customers/early-access.mjs";

// The total an Apple Pay or Google Pay sheet shows on a product page while the
// shopper chooses an address. Same catalog rules as the quote; nothing is stored.
export default async function checkoutEstimate(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "POST") return new Response(null, { status: 404 });
  if (!allowedOrigin(request)) return errorResponse(new CheckoutError("origin_rejected", 403));
  try {
    const { saleAllowList, products } = await currentCatalog();
    const locked = await earlyAccessLocks(request, products, { db: getDatabase });
    const catalog = locked.size ? Object.fromEntries(Object.entries(saleAllowList).filter(([id]) => !locked.has(id))) : saleAllowList;
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env, catalog });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    const body = await jsonBody(request);
    if (Array.isArray(body?.items) && body.items.some((item) => locked.has(item?.variationId))) return errorResponse(new CheckoutError("early_access_only", 403));
    return noStore(await runtime.service.estimate({ items: body?.items, destination: body?.destination }));
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/estimate", method: ["POST"] };
