import { getDatabase } from "@netlify/database";
import {
  body,
  failure,
  HttpError,
  json,
  production,
  type Runtime,
} from "./runtime.ts";
import { routes } from "../src/data/site.ts";
const actions = [
  "page_view",
  "newsletter_signup",
  "support_request",
  "add_to_bag",
  "begin_checkout",
] as const;
export function parseMetric(input: Record<string, unknown>) {
  if (
    Object.keys(input).some(
      (key) => !["event", "path", "device", "value", "consent"].includes(key),
    )
  )
    throw new HttpError(400, "Unexpected event fields.");
  if (
    input.consent !== true ||
    typeof input.event !== "string" ||
    typeof input.path !== "string" ||
    !routes.includes(input.path) ||
    !["mobile", "desktop"].includes(String(input.device))
  )
    throw new HttpError(400, "Invalid event.");
  let bucket = 0;
  let unit = 0;
  if (["LCP", "INP", "CLS"].includes(input.event)) {
    if (
      typeof input.value !== "number" ||
      !Number.isFinite(input.value) ||
      input.value < 0
    )
      throw new HttpError(400, "Invalid metric.");
    unit =
      input.event === "CLS" ? 100 : input.event === "INP" ? 1 / 25 : 1 / 250;
    bucket = Math.ceil(input.value * unit);
    if (!Number.isSafeInteger(bucket) || bucket > 2147483647)
      throw new HttpError(400, "Invalid metric.");
  } else if (
    !actions.includes(input.event as (typeof actions)[number]) ||
    input.value !== undefined
  )
    throw new HttpError(400, "Invalid action.");
  return {
    event: input.event,
    path: input.path,
    device: String(input.device),
    bucket,
  };
}
export async function recordMetric(
  sql: ReturnType<typeof getDatabase>["sql"],
  metric: ReturnType<typeof parseMetric>,
) {
  await sql`INSERT INTO aha_site_metrics (day,path,event,device,bucket,count) VALUES (CURRENT_DATE,${metric.path},${metric.event},${metric.device},${metric.bucket},1)
 ON CONFLICT (day,path,event,device,bucket) DO UPDATE SET count=aha_site_metrics.count+1`;
}
export async function metrics(
  request: Request,
  context: Runtime,
  sqlFactory = () => getDatabase().sql,
) {
  try {
    const metric = parseMetric(await body(request, 2048));
    if (
      !production(context, request) ||
      request.headers.get("sec-gpc") === "1" ||
      request.headers.get("dnt") === "1"
    )
      return json(
        { accepted: false, preview: !production(context, request) },
        202,
      );
    await recordMetric(sqlFactory(), metric);
    return json({ accepted: true }, 202);
  } catch (error) {
    return failure(error);
  }
}
