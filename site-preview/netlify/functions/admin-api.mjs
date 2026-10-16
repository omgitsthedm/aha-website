import { getDatabase } from "@netlify/database";
import { handleAdmin } from "../../server/admin/api.mjs";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";

// Private admin API. Production host only; every route but sign-in needs a
// passkey session (see server/admin/auth.mjs).
export default async function adminApi(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  return handleAdmin(request, { db: getDatabase(), env: Netlify.env, context });
}

export const config = { path: "/api/admin/*" };
