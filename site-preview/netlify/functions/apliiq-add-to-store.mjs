import { getDatabase } from "@netlify/database";
import { callbackTokenValid, createDraftFromApliiq, DraftValidationError, searchDrafts } from "../../server/catalog/drafts.mjs";
import { requireProductionRequest } from "../../server/fulfillment/runtime.mjs";

// Apliiq's "Add to Store" button for our custom store. Apliiq signs nothing,
// so the URL registered in Apliiq carries a long secret token. A call only
// creates or refreshes a draft; the owner approves and the catalog engine
// publishes. Responses use Apliiq's documented shape.
const MAX_BODY = 256 * 1024;
const reply = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const failure = (message, status) => reply({ storeProductId: null, stepsCompleted: 0, hasError: true, errorMessages: [message] }, status);

function token(request) {
  const url = new URL(request.url);
  return request.headers.get("x-apliiq-callback-token") ?? url.searchParams.get("token");
}

export default async function apliiqAddToStore(request, context) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  const expected = Netlify.env.get("APLIIQ_CALLBACK_TOKEN");
  if (!expected) return failure("Add to Store is not configured.", 503);
  if (!callbackTokenValid(token(request), expected)) return failure("Unauthorized.", 401);
  const database = getDatabase();
  if (request.method === "GET") {
    const search = new URL(request.url).searchParams.get("search") ?? "";
    return reply(await searchDrafts(database, search));
  }
  if (request.method !== "POST") return failure("Method not allowed.", 405);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return failure("Payload too large.", 413);
  let body;
  try { body = JSON.parse(raw); } catch { return failure("Body must be JSON.", 400); }
  try {
    const draft = await createDraftFromApliiq(database, body);
    return reply({ storeProductId: draft.id, stepsCompleted: 1, hasError: false, errorMessages: [] });
  } catch (error) {
    if (error instanceof DraftValidationError) return failure(error.message, 422);
    return failure("Draft could not be saved; try again.", 503);
  }
}

export const config = { path: "/api/apliiq/add-to-store", method: ["GET", "POST"] };
