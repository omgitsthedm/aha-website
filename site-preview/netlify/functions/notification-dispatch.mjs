import { getDatabase } from "@netlify/database";
import { AHA_SITE_ID } from "../../server/fulfillment/runtime.mjs";
import { createNotificationRuntime } from "../../server/notifications/runtime.mjs";

export default async function notificationDispatch(_request, context) {
  if (context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== "production") return;
  const runtime = createNotificationRuntime({ database: getDatabase(), env: Netlify.env });
  await runtime.service.dispatch(8);
}
export const config = { schedule: "*/5 * * * *" };
