import type { Config, Context } from "@netlify/functions";
import { orderStatus } from "../../server/order-status.ts";
export default (request: Request, context: Context) =>
  orderStatus(request, context);
export const config: Config = {
  path: "/api/order-status",
  rateLimit: {
    windowLimit: 6,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
    action: "rate_limit",
  },
};
