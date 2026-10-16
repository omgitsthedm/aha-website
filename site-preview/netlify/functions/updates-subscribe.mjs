import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { errorSummary, handleSubscribe } from "../../server/updates/signups.mjs";

// Storefront email sign-up. Production host only; stores the address and sends nothing.
export default async function updatesSubscribe(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  try {
    return await handleSubscribe(request, { db: getDatabase(), clientKey: context?.ip ?? request.headers.get("x-nf-client-connection-ip") ?? "unknown" });
  } catch (error) {
    // Error names and codes only: messages include query parameters such as the address.
    console.error(JSON.stringify({ event: "signup_error", error: errorSummary(error) }));
    return Response.json({ error: "That didn't go through. Try again in a minute." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export const config = { path: "/api/updates/subscribe", method: ["POST"] };
