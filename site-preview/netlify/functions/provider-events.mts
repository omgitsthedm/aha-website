import type { Config, Context } from "@netlify/functions";
import { commerce } from "../../server/commerce.ts";
export default (request: Request, context: Context) =>
  commerce(request, context);
export const config: Config = {
  path: [
    "/api/webhooks/square",
    "/api/webhooks/apliiq/fulfillment",
    "/api/webhooks/printful",
  ],
};
