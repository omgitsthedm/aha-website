import { getDatabase } from "@netlify/database";
import { AHA_SITE_ID, createRuntime } from "../../server/fulfillment/runtime.mjs";
import { currentCatalog } from "../../server/catalog/current.mjs";
import { trackWorker } from "../../server/operations/worker.mjs";

export default async function fulfillmentReconcile(_request, context) {
  // Scheduled functions run only for published deploys. Keep the site-id guard
  // so a copied function can never submit AHA orders from another site.
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  const database = getDatabase();
  await trackWorker(database, "fulfillment", async () => {
    const runtime = createRuntime({ database, env: Netlify.env, catalog: (await currentCatalog()).allowList });
    return runtime.service.runScheduled();
  }, Netlify.env);
}

// A short, bounded drain covers missed callbacks, holds and supplier updates.
export const config = { schedule: "4,19,34,49 * * * *" };
