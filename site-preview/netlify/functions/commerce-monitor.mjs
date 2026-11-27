import { publishSnapshot, snapshotStore, unhealthy } from "../../server/operations/health-snapshot.mjs";
import { heartbeat } from "../../server/operations/heartbeat.mjs";
import { getDatabase } from "@netlify/database";
import { AHA_SITE_ID } from "../../server/fulfillment/runtime.mjs";
import { runCommerceMonitor } from "../../server/operations/commerce.mjs";

export default async function monitor(_request, context) {
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  const started = new Date().toISOString();
  try {
    const result = await runCommerceMonitor({ db: getDatabase(), env: Netlify.env });
    await publishSnapshot(snapshotStore(), result);
    await heartbeat(Netlify.env,"commerce",result.ok);
  } catch (error) {
    await heartbeat(Netlify.env, "commerce", false);
    await publishSnapshot(snapshotStore(), { ...unhealthy("commerce_check_unavailable"), checkedAt: started });
    throw error;
  }
}
// The quarter-hour workers have a 30-second execution limit. Check after
// their minute so routine recovery can finish before we assess the queues.
export const config = { schedule: "8,23,38,53 * * * *" };
