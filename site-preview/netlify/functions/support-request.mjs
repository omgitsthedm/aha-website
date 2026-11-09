import { getDatabase } from "@netlify/database";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";
import { createResendGateway } from "../../server/notifications/resend.mjs";
import { handleSupport } from "../../server/support/request.mjs";

export default async function supportRequest(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  const apiKey = Netlify.env.get("RESEND_API_KEY");
  const from = Netlify.env.get("RESEND_FROM_EMAIL");
  const replyTo = Netlify.env.get("RESEND_REPLY_TO");
  const gateway = apiKey && from && replyTo ? createResendGateway({ apiKey, from, replyTo }) : null;
  return handleSupport(request, {
    db: getDatabase(),
    gateway,
    challengeSecret: Netlify.env.get("AHA_SUPPORT_CHALLENGE_SECRET"),
    clientKey: context?.ip ?? "unknown",
  });
}

export const config = {
  path: "/api/support",
  method: ["POST"],
  rateLimit: { action: "rate_limit", aggregateBy: "ip", windowSize: 60, windowLimit: 5 },
};
