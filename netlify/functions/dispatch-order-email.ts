import { dispatchOrderNotifications } from "../../lib/commerce/notifications";

export default async () => {
  const result = await dispatchOrderNotifications(20);
  console.log(JSON.stringify({ job: "dispatch-order-email", ...result }));
  return new Response(null, { status: 204 });
};

export const config = { schedule: "*/5 * * * *" };
