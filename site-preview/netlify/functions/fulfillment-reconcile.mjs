import { getDatabase } from "@netlify/database";
import { createRuntime } from "../../server/fulfillment/runtime.mjs";

export default async function fulfillmentReconcile(_request, context) {
  // Scheduled functions run only for published deploys. Keep the site-id guard
  // so a copied function can never submit AHA orders from another site.
  if (context?.site?.id !== "275b4115-16bf-42fb-9b36-6bce9bb93608" || context?.deploy?.context !== "production") return;
  const runtime = createRuntime({ database: getDatabase(), env: Netlify.env });
  await runtime.service.runScheduled();
}

export const config = { schedule: "*/5 * * * *" };
