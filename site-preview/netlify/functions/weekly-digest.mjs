import { getDatabase } from "@netlify/database";
import { AHA_SITE_ID } from "../../server/fulfillment/runtime.mjs";
import { runOwnerReport } from "../../server/operations/runtime.mjs";

// Weekly digest for the owner, Mondays 9:30 New York (13:30 UTC): orders,
// revenue, best sellers, checkout drop-off and open problems.
export default async function weeklyDigest(_request, context) {
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  await runOwnerReport("weekly_digest", { db: getDatabase(), env: Netlify.env });
}

export const config = { schedule: "30 13 * * 1" };
