import type { Config, Context } from "@netlify/functions";
import { metrics } from "../../server/metrics.ts";
export default (request: Request, context: Context) =>
  metrics(request, context);
export const config: Config = {
  path: "/api/metrics",
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
    action: "rate_limit",
  },
};
