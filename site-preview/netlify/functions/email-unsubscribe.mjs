import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { handleUnsubscribe } from "../../server/notifications/unsubscribe.mjs";

// One-click unsubscribe (RFC 8058) and the /unsubscribe/ page. Production host only.
export default async function emailUnsubscribe(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  return handleUnsubscribe(request, { db: getDatabase(), env: Netlify.env });
}

export const config = { path: "/api/email/unsubscribe", method: ["POST"] };
