// Router for /api/admin/*. Every route except sign-in requires a session; every
// state change requires the admin header and same-origin request (CSRF), and is
// written to the audit log.
import { randomUUID } from "node:crypto";
import { abandonedCartStats } from "../analytics/abandoned-carts.mjs";
import { approveDraft, DraftValidationError, finishPublishRequest, getDraft, listDrafts, pendingPublishRequests, rejectDraft, updateDraft } from "../catalog/drafts.mjs";
import { AdminAuthError, clearedCookie, createAdminAuth, relyingParty, sameSecret, sessionCookie } from "./auth.mjs";
import { latestReports } from "../operations/runtime.mjs";
import { POSTHOG_PROJECT_URL } from "../platform/client.mjs";
import { currentCatalog } from "../catalog/current.mjs";
import { CatalogActionError, createCatalogActions } from "./catalog-actions.mjs";
import { LiveCatalogError } from "../catalog/live.mjs";
import { createLivePublisher } from "../catalog/publish.mjs";
import { listOrders, overview } from "./orders.mjs";
import { errorSummary, listSignups, removeSignup, signupCounts } from "../updates/signups.mjs";
import { listReviews, moderateReview, pendingReviewCount, ReviewError, reviewTags } from "../customers/reviews.mjs";

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

/** Every product on sale, built or published live, for the admin Products page. */
export async function catalogSummary(load = currentCatalog) {
  const { products, liveProducts, retired = [] } = await load();
  const live = new Set(liveProducts.map((product) => product.slug));
  const removed = new Map(retired.map((entry) => [entry.slug, entry]));
  return {
    products: products.map((product) => ({
      slug: product.slug,
      title: product.title,
      color: product.color,
      collection: product.collection,
      price: product.price,
      sizes: product.variants.map((variant) => variant.size),
      image: { src: product.gallery[0]?.src ?? null, alt: product.gallery[0]?.alt ?? "" },
      squareItemId: product.squareItemId,
      apliiqDesignId: Number(/^APQ-(\d+)S/.exec(product.variants[0]?.sku ?? "")?.[1]) || null,
      source: live.has(product.slug) ? "live" : "built",
      removed: removed.has(product.slug),
      removedAt: removed.get(product.slug)?.retiredAt ?? null,
      apliiqDeleted: Boolean(removed.get(product.slug)?.apliiqDeletedAt),
      url: `/shop/${product.slug}/`,
    })),
  };
}

export async function handleAdmin(request, { db, env, context, live = createLivePublisher(), actions }) {
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
      // Products removed from sale, for the engine's retire-sync. openOrders counts
      // unshipped orders using the design; the engine keeps those in the code.
      if (route === "automation/retired" && method === "GET") {
        const current = await live.catalog();
        const rows = await db.sql`SELECT submitted_items FROM aha_fulfillment_orders WHERE state <> 'shipped'`;
        const skus = rows.flatMap((row) => (typeof row.submitted_items === "string" ? JSON.parse(row.submitted_items) : row.submitted_items ?? []).map((item) => String(item?.sku ?? "")));
        return reply({ products: (current.retired ?? []).map((entry) => {
          const product = current.products.find((item) => item.slug === entry.slug);
          const designSkus = new Set(product?.variants.map((variant) => variant.sku) ?? []);
          return { ...entry, openOrders: skus.filter((sku) => designSkus.has(sku)).length, live: current.liveProducts.some((item) => item.slug === entry.slug) };
        }) });
      }
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
    if (route === "overview" && method === "GET") return reply({ ...await overview(db), signups: await signupCounts(db), reviewsWaiting: await pendingReviewCount(db), reports: await latestReports(db) });
    if (route === "orders" && method === "GET") return reply({ orders: await listOrders(db) });
    if (route === "catalog" && method === "GET") return reply(await catalogSummary(live.catalog));
    // Email list: addresses from the storefront sign-up form. Removal is by row id,
    // so the audit log never holds the address.
    if (route === "signups" && method === "GET") return reply(await listSignups(db));
    const signupAction = /^signups\/(\d{1,18})\/remove$/.exec(route);
    if (signupAction && method === "POST") {
      const removed = await removeSignup(db, signupAction[1]);
      await auth.audit(user.id, "signup.removed", signupAction[1], { removed });
      return reply({ removed });
    }
    // Reviews wait here until approved; approving or rejecting refreshes the product's cached reviews.
    if (route === "reviews" && method === "GET") return reply(await listReviews(db, url.searchParams.get("status") ?? "pending"));
    const reviewAction = /^reviews\/(\d{1,18})\/(approve|reject)$/.exec(route);
    if (reviewAction && method === "POST") {
      const result = await moderateReview(db, reviewAction[1], reviewAction[2]);
      // purge() retries once and reports false instead of throwing; the CDN copy expires within ten minutes regardless.
      const refreshed = await Promise.resolve().then(() => live.purge(reviewTags(result.product))).catch(() => false);
      await auth.audit(user.id, `review.${reviewAction[2]}`, reviewAction[1], { ...result, refreshed });
      return reply({ ...result, refreshed });
    }
    const productAction = /^catalog\/([a-z0-9-]+)\/(remove|restore|delete-apliiq-design)$/.exec(route);
    if (productAction && method === "POST") {
      const [, slug, action] = productAction;
      const catalogActions = actions ?? createCatalogActions({ db, env, catalog: live.catalog, purge: live.purge });
      const input = action === "delete-apliiq-design" ? await body(request) : {};
      const result = action === "remove" ? await catalogActions.remove(slug, { by: user.email })
        : action === "restore" ? await catalogActions.restore(slug)
          : await catalogActions.deleteApliiqDesign(slug, { confirm: input.confirm });
      await auth.audit(user.id, `catalog.${action}`, slug, result);
      return reply(result);
    }
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
      return reply({ abandonedCarts: await abandonedCartStats(db.sql), posthogProjectUrl: env.get("PUBLIC_POSTHOG_PROJECT_URL") || POSTHOG_PROJECT_URL });
    }
    return reply({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof AdminAuthError) return reply({ error: error.message }, error.status);
    if (error instanceof DraftValidationError || error instanceof LiveCatalogError) return reply({ error: error.message }, 422);
    if (error instanceof CatalogActionError) return reply({ error: error.message }, error.status);
    if (error instanceof ReviewError) return reply({ error: error.message }, error.status);
    // Error names and codes only: never request bodies, cookies, headers or query parameters.
    console.error(JSON.stringify({ event: "admin_api_error", route, error: errorSummary(error) }));
    return reply({ error: "Something went wrong. Try again." }, 500);
  }
}
