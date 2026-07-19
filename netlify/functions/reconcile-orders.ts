import { reconcilePaidOrders } from "../../lib/commerce/reconciliation";
import { dispatchOrderNotifications } from "../../lib/commerce/notifications";
import { isScheduledInvocation } from "../../lib/security/cron-guard";

export default async (req: Request) => {
  if (!(await isScheduledInvocation(req))) {
    return new Response("Not found", { status: 404 });
  }
  const result = await reconcilePaidOrders(3);
  const email = await dispatchOrderNotifications(10);
  console.log(JSON.stringify({ job: "reconcile-orders", ...result, email }));
  return new Response(null, { status: 204 });
};

export const config = { schedule: "*/15 * * * *" };
