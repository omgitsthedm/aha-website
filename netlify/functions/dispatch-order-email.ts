import { dispatchOrderNotifications } from "../../lib/commerce/notifications";
import { automationsEnabled, isScheduledInvocation } from "../../lib/security/cron-guard";

export default async (req: Request) => {
  if (!automationsEnabled() || !(await isScheduledInvocation(req))) {
    return new Response(null, { status: 204 });
  }
  const result = await dispatchOrderNotifications(20);
  console.log(JSON.stringify({ job: "dispatch-order-email", ...result }));
  return new Response(null, { status: 204 });
};
