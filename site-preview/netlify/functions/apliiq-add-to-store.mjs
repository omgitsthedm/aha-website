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

// Apliiq's custom-store settings still hold the addresses and token of the
// original app (/api/integrations/apliiq/products/upsert and /search, token
// APLIIQ_PRODUCT_CALLBACK_TOKEN). Both forms are served, so nothing has to be
// re-entered in Apliiq.
export async function handleAddToStore(request, context, { env = Netlify.env, database = () => getDatabase() } = {}) {
  if (!requireProductionRequest(request, context)) return new Response(null, { status: 404 });
  const expected = [env.get("APLIIQ_CALLBACK_TOKEN"), env.get("APLIIQ_PRODUCT_CALLBACK_TOKEN")].filter(Boolean);
  if (!expected.length) return failure("Add to Store is not configured.", 503);
  const provided = token(request);
  if (!expected.some((value) => callbackTokenValid(provided, value))) return failure("Unauthorized.", 401);
  const db = database();
  if (request.method === "GET") {
    const search = new URL(request.url).searchParams.get("search") ?? "";
    return reply(await searchDrafts(db, search));
  }
  if (request.method !== "POST") return failure("Method not allowed.", 405);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return failure("Payload too large.", 413);
  let body;
  try { body = JSON.parse(raw); } catch { return failure("Body must be JSON.", 400); }
  try {
    const draft = await createDraftFromApliiq(db, body);
    return reply({ storeProductId: draft.id, stepsCompleted: 1, hasError: false, errorMessages: [] });
  } catch (error) {
    if (error instanceof DraftValidationError) return failure(error.message, 422);
    return failure("Draft could not be saved; try again.", 503);
  }
}

export default (request, context) => handleAddToStore(request, context);

export const config = { path: ["/api/apliiq/add-to-store", "/api/integrations/apliiq/products/upsert", "/api/integrations/apliiq/products/search"], method: ["GET", "POST"] };
