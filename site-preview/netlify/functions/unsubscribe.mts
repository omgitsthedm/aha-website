import type { Config, Context } from "@netlify/functions";
import { unsubscribe } from "../../server/preferences.ts";
export default (request: Request, context: Context) =>
  unsubscribe(request, context);
export const config: Config = {
  path: "/api/unsubscribe",
  rateLimit: {
    windowLimit: 6,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
    action: "rate_limit",
  },
};
