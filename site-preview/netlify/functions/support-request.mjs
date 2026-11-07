import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { createNotificationRuntime } from "../../server/notifications/runtime.mjs";
import { dispatchAfterResponse } from "../../server/notifications/dispatch-after.mjs";
import { handleSupport } from "../../server/support/request.mjs";

export default async function supportRequest(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  const db = getDatabase();
  const response = await handleSupport(request, {
    db, challengeSecret: Netlify.env.get("AHA_SUPPORT_CHALLENGE_SECRET"), clientKey: context?.ip ?? "unknown",
  });
  if (response.ok) await dispatchAfterResponse(createNotificationRuntime({database:db, env:Netlify.env}),context);
  return response;
}

export const config = {
  path: "/api/support",
  method: ["POST"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 5 },
};
