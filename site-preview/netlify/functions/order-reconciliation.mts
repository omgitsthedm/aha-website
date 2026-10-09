import type { Config, Context } from "@netlify/functions";
import { env, production } from "../../server/runtime.ts";
export default async (request: Request, context: Context) => {
  if (
    !production(context) ||
    env("AHA_ORDER_SERVICES_ENABLED") !== "true" ||
    env("AHA_AUTOMATIONS_ENABLED") !== "true"
  )
    return new Response(null, { status: 204 });
  const { runLegacy } = await import("../../.server/legacy.mjs");
  return runLegacy("reconcile", request);
};
export const config: Config = { schedule: "*/15 * * * *" };
