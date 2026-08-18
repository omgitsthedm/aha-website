import { reconcilePaidOrders, sweepStalledApliiqFulfillments } from "../../lib/commerce/reconciliation";
import { dispatchOrderNotifications } from "../../lib/commerce/notifications";
import { isScheduledInvocation } from "../../lib/security/cron-guard";

export default async (req: Request) => {
  if (!(await isScheduledInvocation(req))) {
    return new Response("Not found", { status: 404 });
  }
  const result = await reconcilePaidOrders(3);
  // Pull half of the APLIIQ contract: their Fulfillment callback URL is blank,
  // so nothing pushes a status change and a submitted order would otherwise sit
  // at draft_created forever. A provider outage here must not stop the email
  // dispatch below, so the sweep is contained.
  const sweep = await sweepStalledApliiqFulfillments({ limit: 5 })
    .catch((error: unknown) => ({ error: error instanceof Error ? error.message.slice(0, 200) : "sweep failed" }));
  const email = await dispatchOrderNotifications(10);
  console.log(JSON.stringify({ job: "reconcile-orders", ...result, sweep, email }));
  return new Response(null, { status: 204 });
};

export const config = { schedule: "*/15 * * * *" };
