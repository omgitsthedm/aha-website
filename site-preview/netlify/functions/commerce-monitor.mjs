import { getDatabase } from "@netlify/database";
import { AHA_SITE_ID } from "../../server/fulfillment/runtime.mjs";
import { runCommerceMonitor } from "../../server/operations/commerce.mjs";

export default async function monitor(_request, context) {
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  await runCommerceMonitor({ db: getDatabase(), env: Netlify.env });
}
// Every quarter hour in UTC, offset from the notification recovery worker.
export const config = { schedule: "7,22,37,52 * * * *" };
