import { getDatabase } from "@netlify/database";
import { AHA_SITE_ID } from "../../server/fulfillment/runtime.mjs";
import { runOwnerReport } from "../../server/operations/runtime.mjs";

// Daily health check during the shared database window (13:07 UTC). Emails the owner only when
// Square, the feeds, orders, email or publishing need a person.
export default async function operationsHealth(_request, context) {
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  await runOwnerReport("daily_health", { db: getDatabase(), env: Netlify.env });
}

export const config = { schedule: "7 13 * * *" };
