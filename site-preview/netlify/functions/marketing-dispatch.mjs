import { getDatabase } from "@netlify/database";
import { AHA_SITE_ID } from "../../server/fulfillment/runtime.mjs";
import { createMarketingRuntime } from "../../server/analytics/marketing-runtime.mjs";

// Retry only rows created by a future confirmed checkout. This job never
// searches Square, so enabling it cannot backfill historical purchases.
export default async function marketingDispatch(_request, context) {
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  const runtime = createMarketingRuntime({ database: getDatabase(), env: Netlify.env });
  await runtime.service.dispatch(20);
}
export const config = { schedule: "0 * * * *" };
