import { getDatabase } from "@netlify/database";
import { createRuntime } from "../../server/fulfillment/runtime.mjs";
import { currentCatalog } from "../../server/catalog/current.mjs";

export default async function fulfillmentReconcile(_request, context) {
  // Scheduled functions run only for published deploys. Keep the site-id guard
  // so a copied function can never submit AHA orders from another site.
  if (context?.site?.id !== "275b4115-16bf-42fb-9b36-6bce9bb93608" || context?.deploy?.context !== "production") return;
  const runtime = createRuntime({ database: getDatabase(), env: Netlify.env, catalog: (await currentCatalog()).allowList });
  await runtime.service.runScheduled();
}

// Paid orders are submitted inline by the Square webhook. This hourly run is the
// safety net for deferred, pending and uncertain records; running it every five
// minutes kept Netlify Database awake around the clock.
export const config = { schedule: "0 * * * *" };
