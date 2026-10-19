import { getDatabase } from "@netlify/database";
import { allowedOrigin, checkoutReady, createCheckoutRuntime, requireProductionRequest } from "../../server/checkout/runtime.mjs";
import { CheckoutError, errorResponse } from "../../server/checkout/errors.mjs";
import { jsonBody, noStore } from "../../server/checkout/http.mjs";
import { afterResponse, checkoutProperties, createPostHogCapture, posthogConfig } from "../../server/analytics/posthog.mjs";
import { currentCatalog } from "../../server/catalog/current.mjs";
import { earlyAccessLocks } from "../../server/customers/early-access.mjs";

function posthogIds(body) {
  if (body?.analytics) return body.analytics;
  const analytics = body?.marketing?.analytics;
  return analytics?.consent === true ? { distinctId: analytics.posthogDistinctId, sessionId: analytics.posthogSessionId } : undefined;
}

export default async function checkoutQuote(request, context) {
  if (!requireProductionRequest(request, context) || request.method !== "POST") return new Response(null, { status: 404 });
  if (!allowedOrigin(request)) return errorResponse(new CheckoutError("origin_rejected", 403));
  try {
    // Only what is on sale: removed products can't be quoted, though paid ones still ship.
    const { saleAllowList, products } = await currentCatalog();
    // A drop not yet released is for signed-in account holders during early access only.
    const locked = await earlyAccessLocks(request, products, { db: getDatabase });
    const catalog = locked.size ? Object.fromEntries(Object.entries(saleAllowList).filter(([id]) => !locked.has(id))) : saleAllowList;
    const runtime = createCheckoutRuntime({ database: getDatabase(), env: Netlify.env, catalog });
    if (!checkoutReady(runtime.config)) return errorResponse(new CheckoutError("checkout_unavailable", 503));
    const body = await jsonBody(request);
    if (Array.isArray(body?.items) && body.items.some((item) => locked.has(item?.variationId))) return errorResponse(new CheckoutError("early_access_only", 403));
    const marketing = body?.marketing && typeof body.marketing === "object"
      ? { ...body.marketing, marketing: { ...(body.marketing.marketing ?? {}), userAgent: request.headers.get("user-agent") } }
      : body?.marketing;
    const quote = await runtime.service.quote({ items: body?.items, shippingAddress: body?.shippingAddress, analytics: body?.analytics, marketing });
    // Analytics never delays or fails a quote.
    await afterResponse(context, createPostHogCapture(posthogConfig(Netlify.env))("checkout_quoted", posthogIds(body), checkoutProperties({ totalCents: quote.totalAmount, items: quote.lineItems })));
    return noStore(quote);
  } catch (error) { return errorResponse(error); }
}
export const config = { path: "/api/checkout/quote", method: ["POST"] };
