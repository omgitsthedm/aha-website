import { getDatabase } from "@netlify/database";
import { handleAccount } from "../../server/customers/api.mjs";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";

// Customer accounts (passkeys only). Production host only.
export default async function accountApi(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  return handleAccount(request, { db: getDatabase(), env: Netlify.env, context });
}

export const config = { path: "/api/account/*" };
