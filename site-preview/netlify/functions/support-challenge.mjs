import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { handleSupportChallenge } from "../../server/support/challenge.mjs";

export default async function supportChallenge(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  return handleSupportChallenge(request, {
    db: getDatabase(),
    secret: Netlify.env.get("AHA_SUPPORT_CHALLENGE_SECRET"),
    clientKey: context?.ip ?? "unknown",
  });
}

export const config = {
  path: "/api/support/challenge",
  method: ["GET"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 8 },
};
