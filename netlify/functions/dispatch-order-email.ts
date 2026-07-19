import { dispatchOrderNotifications } from "../../lib/commerce/notifications";
import { isScheduledInvocation } from "../../lib/security/cron-guard";

export default async (req: Request) => {
  if (!(await isScheduledInvocation(req))) {
    return new Response("Not found", { status: 404 });
  }
  const result = await dispatchOrderNotifications(20);
  console.log(JSON.stringify({ job: "dispatch-order-email", ...result }));
  return new Response(null, { status: 204 });
};

export const config = { schedule: "*/5 * * * *" };
