import type { Config, Context } from "@netlify/functions";
import { commerce } from "../../server/commerce.ts";
export default (request: Request, context: Context) =>
  commerce(request, context);
export const config: Config = {
  path: ["/api/commerce", "/api/checkout-quote", "/api/create-payment"],
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
    action: "rate_limit",
  },
};
