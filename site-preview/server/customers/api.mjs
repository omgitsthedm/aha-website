// Router for /api/account/*: passkey sign-in, saved pieces, orders added from
// their private links, and deleting the account. Every change needs the
// account header and a same-origin request (CSRF).
import { currentCatalog } from "../catalog/current.mjs";
import { customerView, orderStatusUrl, verifyOrderToken } from "../orders/status.mjs";
import { errorSummary } from "../updates/signups.mjs";
import { AccountError, accountCookie, accountFor, accountRelyingParty, clearedAccountCookie, createAccountAuth } from "./auth.mjs";

const HEADERS = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
const reply = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...HEADERS, ...extra } });
const MAX_BODY = 32 * 1024;
export const MAX_SAVED = 60;

async function body(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new AccountError("Request too large.", 413);
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new AccountError("Request must be JSON.", 400); }
}

/** Saved slugs that name a product, de-duplicated, newest list order kept. */
export function cleanSaved(list, products) {
  if (!Array.isArray(list)) return [];
  const known = new Set(products.map((product) => product.slug));
  return [...new Set(list.filter((slug) => typeof slug === "string" && known.has(slug)))].slice(0, MAX_SAVED);
}

async function savedFor(db, customerId) {
  return (await db.sql`SELECT product_slug FROM aha_customer_saved WHERE customer_id = ${customerId} ORDER BY saved_at DESC, product_slug`).map((row) => row.product_slug);
}

async function replaceSaved(db, customerId, slugs) {
  await db.sql`DELETE FROM aha_customer_saved WHERE customer_id = ${customerId} AND NOT (product_slug = ANY(${slugs}))`;
  // Newest first: the first slug gets the latest time.
  const base = Date.now();
  for (const [index, slug] of slugs.entries()) {
    await db.sql`INSERT INTO aha_customer_saved (customer_id, product_slug, saved_at) VALUES (${customerId}, ${slug}, ${new Date(base - index * 1000).toISOString()}) ON CONFLICT (customer_id, product_slug) DO UPDATE SET saved_at = EXCLUDED.saved_at`;
  }
}

async function ordersFor(db, env, customerId) {
  const rows = await db.sql`
    SELECT o.square_order_id, f.state, f.apliiq_order_id, f.apliiq_payload, f.submitted_items, f.tracking, f.payment_created_at, f.created_at
    FROM aha_customer_orders o LEFT JOIN aha_fulfillment_orders f ON f.square_order_id = o.square_order_id
    WHERE o.customer_id = ${customerId} ORDER BY o.linked_at DESC LIMIT 50`;
  return rows.map((row) => {
    const link = orderStatusUrl(row.square_order_id, env);
    return { ...customerView(row.square_order_id, row.state ? row : null), url: link ? new URL(link).pathname + new URL(link).search : null };
  });
}

export async function handleAccount(request, { db, env, context, catalog = currentCatalog }) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/account\/?/, "").replace(/\/$/, "");
  const method = request.method;
  const auth = createAccountAuth({ db, env });
  const { origin } = accountRelyingParty(env);
  const clientKey = context?.ip ?? request.headers.get("x-nf-client-connection-ip") ?? "unknown";
  try {
    if (method !== "GET" && !(request.headers.get("origin") === origin && request.headers.get("x-aha-account") === "1")) return reply({ error: "Request blocked." }, 403);
    const products = async () => (await catalog()).products;

    if (route === "auth/register/options" && method === "POST") return reply(await auth.registrationOptions({ clientKey }));
    if (route === "auth/login/options" && method === "POST") return reply(await auth.loginOptions({ clientKey }));
    if ((route === "auth/register/verify" || route === "auth/login/verify") && method === "POST") {
      const input = await body(request);
      const verify = route === "auth/register/verify" ? auth.registrationVerify : auth.loginVerify;
      const { customerId, token } = await verify({ handle: input.handle, response: input.response, clientKey });
      // Pieces saved on this device before signing in join the account.
      const local = cleanSaved(input.saved, await products());
      if (local.length) await replaceSaved(db, customerId, cleanSaved([...local, ...await savedFor(db, customerId)], await products()));
      return reply({ ok: true }, 200, { "set-cookie": accountCookie(token) });
    }
    if (route === "auth/logout" && method === "POST") { await auth.endSession(request); return reply({ ok: true }, 200, { "set-cookie": clearedAccountCookie() }); }

    const customerId = await accountFor(request, db);
    if (route === "me" && method === "GET" && !customerId) return reply({ signedIn: false });
    if (!customerId) return reply({ error: "Sign in to your account first." }, 401);

    if (route === "me" && method === "GET") return reply({ signedIn: true, saved: await savedFor(db, customerId), orders: await ordersFor(db, env, customerId) });
    if (route === "saved" && method === "PUT") {
      const input = await body(request);
      const saved = cleanSaved(input.saved, await products());
      await replaceSaved(db, customerId, saved);
      return reply({ saved });
    }
    if (route === "orders" && method === "POST") {
      const input = await body(request);
      if (!verifyOrderToken(input.o, input.k, env)) return reply({ error: "We couldn't find that order. Use the link in your order email." }, 404);
      const [order] = await db.sql`SELECT square_order_id FROM aha_fulfillment_orders WHERE square_order_id = ${input.o}`;
      if (!order) return reply({ error: "We couldn't find that order. Use the link in your order email." }, 404);
      const [linked] = await db.sql`INSERT INTO aha_customer_orders (square_order_id, customer_id) VALUES (${input.o}, ${customerId}) ON CONFLICT (square_order_id) DO NOTHING RETURNING customer_id`;
      if (!linked) {
        const [owner] = await db.sql`SELECT customer_id FROM aha_customer_orders WHERE square_order_id = ${input.o}`;
        if (owner?.customer_id !== customerId) return reply({ error: "This order is already in another account." }, 409);
      }
      return reply({ ok: true });
    }
    if (route === "me" && method === "DELETE") {
      await db.sql`DELETE FROM aha_customers WHERE id = ${customerId}`;
      return reply({ deleted: true }, 200, { "set-cookie": clearedAccountCookie() });
    }
    return reply({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof AccountError) return reply({ error: error.message }, error.status);
    // Error names and codes only: never request bodies, cookies or headers.
    console.error(JSON.stringify({ event: "account_api_error", route, error: errorSummary(error) }));
    return reply({ error: "Something went wrong. Try again." }, 500);
  }
}
