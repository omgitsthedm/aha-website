// Router for /api/admin/*. Every route except sign-in requires a session; every
// state change requires the admin header and same-origin request (CSRF), and is
// written to the audit log.
import { randomUUID } from "node:crypto";
import { abandonedCartStats } from "../analytics/abandoned-carts.mjs";
import { approveDraft, DraftValidationError, finishPublishRequest, getDraft, listDrafts, pendingPublishRequests, rejectDraft, updateDraft } from "../catalog/drafts.mjs";
import { AdminAuthError, clearedCookie, createAdminAuth, relyingParty, sameSecret, sessionCookie } from "./auth.mjs";
import { latestReports } from "../operations/runtime.mjs";
import { LiveCatalogError } from "../catalog/live.mjs";
import { createLivePublisher } from "../catalog/publish.mjs";
import { listOrders, overview } from "./orders.mjs";

const HEADERS = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
const reply = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...HEADERS, ...extra } });
const MAX_BODY = 64 * 1024;

async function body(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new AdminAuthError("Request too large.", 413);
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new AdminAuthError("Request must be JSON.", 400); }
}

function sameOrigin(request, origin) {
  return request.headers.get("origin") === origin && request.headers.get("x-aha-admin") === "1";
}

export async function handleAdmin(request, { db, env, context, live = createLivePublisher() }) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/admin\/?/, "").replace(/\/$/, "");
  const parts = route.split("/");
  const method = request.method;
  const auth = createAdminAuth({ db, env });
  const { origin } = relyingParty(env);
  const clientKey = context?.ip ?? request.headers.get("x-nf-client-connection-ip") ?? "unknown";
  try {
    // Automation for the catalog engine: a long bearer token, publish requests only.
    if (parts[0] === "automation") {
      const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!sameSecret(bearer, env.get("ADMIN_AUTOMATION_TOKEN"))) return reply({ error: "Unauthorized." }, 401);
      if (route === "automation/publish-requests" && method === "GET") return reply({ requests: await pendingPublishRequests(db) });
      if (parts[1] === "publish-requests" && parts.length === 3 && method === "POST") {
        const input = await body(request);
        const updated = await finishPublishRequest(db, parts[2], { status: input.status, result: input.result });
        if (!updated) return reply({ error: "Not found." }, 404);
        await auth.audit(null, `publish.${input.status}`, parts[2], { result: input.result ?? {} });
        return reply({ ok: true });
      }
      // Live catalog: publish products without a site build (see server/catalog/live.mjs).
      if (parts[1] === "live-products" || parts[1] === "live-images") {
        if (method !== "GET" && context?.deploy?.context !== "production") return reply({ error: "Live publishing runs only on the production site." }, 403);
        if (route === "automation/live-products" && method === "GET") return reply({ products: await live.list() });
        if (parts[1] === "live-products" && parts.length === 3 && method === "PUT") {
          const result = await live.putProduct(parts[2], await body(request));
          await auth.audit(null, "live.publish", parts[2], {});
          return reply(result);
        }
        if (parts[1] === "live-products" && parts.length === 3 && method === "DELETE") {
          const result = await live.removeProduct(parts[2]);
          await auth.audit(null, "live.remove", parts[2], { removed: result.removed });
          return reply(result);
        }
        if (parts[1] === "live-images" && parts.length === 5 && method === "PUT") {
          const bytes = await request.arrayBuffer();
          return reply(await live.putImage(parts.slice(2).join("/"), bytes));
        }
      }
      return reply({ error: "Not found." }, 404);
    }
    if (method !== "GET" && !sameOrigin(request, origin)) return reply({ error: "Request blocked." }, 403);

    // Sign-in routes.
    if (route === "auth/register/options" && method === "POST") {
      const input = await body(request);
      return reply(await auth.registrationOptions({ request, bootstrapToken: input.bootstrapToken, email: input.email, clientKey }));
    }
    if (route === "auth/register/verify" && method === "POST") {
      const input = await body(request);
      const token = await auth.registrationVerify({ handle: input.handle, response: input.response, clientKey });
      return reply({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
    }
    if (route === "auth/login/options" && method === "POST") return reply(await auth.loginOptions({ clientKey }));
    if (route === "auth/login/verify" && method === "POST") {
      const input = await body(request);
      const token = await auth.loginVerify({ handle: input.handle, response: input.response, clientKey });
      return reply({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
    }

    const user = await auth.sessionUser(request);
    if (!user) return reply({ error: "Sign in required." }, 401);

    if (route === "auth/logout" && method === "POST") { await auth.endSession(request); return reply({ ok: true }, 200, { "set-cookie": clearedCookie() }); }
    if (route === "me" && method === "GET") return reply({ email: user.email });
    if (route === "overview" && method === "GET") return reply({ ...await overview(db), reports: await latestReports(db) });
    if (route === "orders" && method === "GET") return reply({ orders: await listOrders(db) });
    if (parts[0] === "orders" && parts[2] === "note" && method === "POST") {
      const input = await body(request);
      const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
      if (!note) return reply({ error: "Write a note." }, 422);
      await auth.audit(user.id, "order.note", parts[1], { note });
      return reply({ ok: true });
    }
    if (route === "drafts" && method === "GET") return reply({ drafts: await listDrafts(db, { status: url.searchParams.get("status") || undefined }) });
    if (parts[0] === "drafts" && parts.length === 2 && method === "PATCH") {
      const draft = await updateDraft(db, parts[1], await body(request));
      if (!draft) return reply({ error: "Draft not found." }, 404);
      await auth.audit(user.id, "draft.updated", parts[1]);
      return reply({ draft });
    }
    if (parts[0] === "drafts" && parts[2] === "approve" && method === "POST") {
      const draft = await approveDraft(db, parts[1], { actor: user.email });
      if (!draft) return reply({ error: "Only an open draft can be approved." }, 409);
      await auth.audit(user.id, "draft.approved", parts[1]);
      return reply({ draft });
    }
    if (parts[0] === "drafts" && parts[2] === "reject" && method === "POST") {
      const input = await body(request);
      const draft = await rejectDraft(db, parts[1], { actor: user.email, reason: input.reason });
      if (!draft) return reply({ error: "Draft not found." }, 404);
      await auth.audit(user.id, "draft.rejected", parts[1], { reason: input.reason });
      return reply({ draft });
    }
    if (parts[0] === "drafts" && parts[2] === "publish" && method === "POST") {
      const draft = await getDraft(db, parts[1]);
      if (!draft || draft.status !== "approved") return reply({ error: "Approve the draft before publishing." }, 409);
      const id = `pub_${randomUUID()}`;
      await db.sql`INSERT INTO aha_publish_requests (id, draft_id, requested_by) VALUES (${id}, ${draft.id}, ${user.email})`;
      await auth.audit(user.id, "draft.publish_requested", draft.id, { request: id });
      return reply({ request: id, status: "requested" }, 202);
    }
    if (route === "publish-requests" && method === "GET") {
      const rows = await db.sql`SELECT id, draft_id, requested_by, status, result_json, created_at, updated_at FROM aha_publish_requests ORDER BY created_at DESC LIMIT 50`;
      return reply({ requests: rows });
    }
    if (route === "analytics" && method === "GET") {
      return reply({ abandonedCarts: await abandonedCartStats(db.sql), posthogProjectUrl: env.get("PUBLIC_POSTHOG_PROJECT_URL") || null });
    }
    return reply({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof AdminAuthError) return reply({ error: error.message }, error.status);
    if (error instanceof DraftValidationError || error instanceof LiveCatalogError) return reply({ error: error.message }, 422);
    return reply({ error: "Something went wrong. Try again." }, 500);
  }
}
