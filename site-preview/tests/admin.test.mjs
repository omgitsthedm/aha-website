import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { handleAdmin } from "../server/admin/api.mjs";
import { SESSION_COOKIE } from "../server/admin/auth.mjs";
import { orderFlags } from "../server/admin/orders.mjs";
import { createDraftFromApliiq } from "../server/catalog/drafts.mjs";

const ORIGIN = "https://afterhoursagenda.com";
const migrations = [
  "20261015045000_yikes_fulfillment", "20261015160000_custom_checkout", "20261015170000_order_notifications",
  "20261015180000_checkout_payment_recovery", "20261016100000_checkout_analytics_link", "20261016110000_product_drafts", "20261016120000_admin", "20261016130000_owner_reports",
];

async function isolated(t) {
  const database = new PGlite(); t.after(() => database.close());
  for (const name of migrations) await database.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const sql = async (strings, ...parameters) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { sql };
}
const env = (values = {}) => ({ get: (key) => ({ ADMIN_ORIGIN: ORIGIN, ADMIN_BOOTSTRAP_TOKEN: "b".repeat(32), ...values })[key] });
function request(path, { method = "GET", body, cookie, headers = {} } = {}) {
  return new Request(`${ORIGIN}/api/admin/${path}`, { method, body: body ? JSON.stringify(body) : undefined, headers: { ...(method === "GET" ? {} : { origin: ORIGIN, "x-aha-admin": "1" }), ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}), ...headers } });
}
async function signedIn(db) {
  await db.sql`INSERT INTO aha_admin_users (id, email) VALUES ('adm_1', 'info@afterhoursagenda.com')`;
  const token = "session-token-for-tests";
  await db.sql`INSERT INTO aha_admin_sessions (token_sha256, user_id, expires_at) VALUES (${createHash("sha256").update(token).digest("hex")}, 'adm_1', now() + interval '1 hour')`;
  return token;
}
const call = (db, path, options, values) => handleAdmin(request(path, options), { db, env: env(values), context: { ip: "203.0.113.9" } }).then(async (response) => ({ status: response.status, body: await response.json(), headers: response.headers }));

test("admin migration is identical at both discovery paths", async () => {
  assert.equal(await readFile(new URL("../netlify/database/migrations/20261016120000_admin/migration.sql", import.meta.url), "utf8"), await readFile(new URL("../../netlify/database/migrations/20261016120000_admin/migration.sql", import.meta.url), "utf8"));
});

test("every admin data route requires a session", async (t) => {
  const db = await isolated(t);
  for (const [path, method] of [["me", "GET"], ["overview", "GET"], ["orders", "GET"], ["drafts", "GET"], ["analytics", "GET"], ["publish-requests", "GET"], ["drafts/x/approve", "POST"], ["drafts/x/publish", "POST"], ["orders/x/note", "POST"], ["auth/logout", "POST"]]) {
    const result = await call(db, path, { method });
    assert.equal(result.status, 401, `${method} ${path}`);
  }
});

test("state changes from another origin or without the admin header are blocked", async (t) => {
  const db = await isolated(t);
  const cookie = await signedIn(db);
  const foreign = await handleAdmin(new Request(`${ORIGIN}/api/admin/drafts/x/approve`, { method: "POST", headers: { origin: "https://evil.example", "x-aha-admin": "1", cookie: `${SESSION_COOKIE}=${cookie}` } }), { db, env: env(), context: {} });
  assert.equal(foreign.status, 403);
  const noHeader = await handleAdmin(new Request(`${ORIGIN}/api/admin/drafts/x/approve`, { method: "POST", headers: { origin: ORIGIN, cookie: `${SESSION_COOKIE}=${cookie}` } }), { db, env: env(), context: {} });
  assert.equal(noHeader.status, 403);
});

test("the first passkey needs the one-time setup code; later ones need a session", async (t) => {
  const db = await isolated(t);
  const wrong = await call(db, "auth/register/options", { method: "POST", body: { email: "info@afterhoursagenda.com", bootstrapToken: "nope" } });
  assert.equal(wrong.status, 403);
  const right = await call(db, "auth/register/options", { method: "POST", body: { email: "info@afterhoursagenda.com", bootstrapToken: "b".repeat(32) } });
  assert.equal(right.status, 200);
  assert.equal(right.body.options.rp.id, "afterhoursagenda.com");
  assert.equal(right.body.options.authenticatorSelection.userVerification, "required");
  assert.equal(right.body.options.timeout, 240_000, "the passkey prompt waits four minutes, inside the five-minute challenge");
  await signedIn(db);
  const afterSetup = await call(db, "auth/register/options", { method: "POST", body: { email: "x@example.com", bootstrapToken: "b".repeat(32) } });
  assert.equal(afterSetup.status, 403);
});

test("sign-in attempts are rate limited", async (t) => {
  const db = await isolated(t);
  let last;
  for (let attempt = 0; attempt < 31; attempt += 1) last = await call(db, "auth/login/options", { method: "POST" });
  assert.equal(last.status, 429);
});

test("approving and publishing a draft is audited and queues a publish request", async (t) => {
  const db = await isolated(t);
  const cookie = await signedIn(db);
  const draft = await createDraftFromApliiq(db, { name: "Pet It Be Crewneck", currency: "USD", imageUrls: [], sizes: ["M"], colors: ["Cranberry"], variants: [{ sku: "APQ-6300000S7A1", price: 26.39, size: "M" }] }, { createId: () => "d1" });
  assert.equal((await call(db, `drafts/${draft.id}/publish`, { method: "POST", cookie })).status, 409);
  const approved = await call(db, `drafts/${draft.id}/approve`, { method: "POST", cookie });
  assert.equal(approved.body.draft.status, "approved");
  assert.equal(approved.body.draft.approved_by, "info@afterhoursagenda.com");
  const publish = await call(db, `drafts/${draft.id}/publish`, { method: "POST", cookie });
  assert.equal(publish.status, 202);
  const audit = await db.sql`SELECT action FROM aha_admin_audit ORDER BY id`;
  assert.deepEqual(audit.map((row) => row.action), ["draft.approved", "draft.publish_requested"]);
  assert.equal((await db.sql`SELECT count(*) AS n FROM aha_publish_requests`)[0].n, 1);
});

test("orders show first name and city only, with plain-language flags", async (t) => {
  const db = await isolated(t);
  const cookie = await signedIn(db);
  await db.sql`INSERT INTO aha_fulfillment_orders (square_order_id, state, submitted_items, created_at, customer_email) VALUES ('ORDER1', 'uncertain', '[{"title":"Yikes! Crewneck","size":"M","quantity":1}]', now() - interval '3 days', 'jane@example.com')`;
  const result = await call(db, "orders", { cookie });
  assert.equal(result.status, 200);
  const [order] = result.body.orders;
  assert.deepEqual(order.flags.map((flag) => flag.code), ["uncertain", "stuck"]);
  assert.doesNotMatch(JSON.stringify(result.body), /jane@example\.com/);
});

test("order flags stay quiet for a fresh shipped order", () => {
  assert.deepEqual(orderFlags({ state: "shipped", created_at: new Date().toISOString() }), []);
  assert.deepEqual(orderFlags({ state: "submitted_processed", created_at: new Date(Date.now() - 50 * 3_600_000).toISOString() }).map((flag) => flag.code), ["stuck"]);
});

test("admin Products lists every product on sale, built or published live", async () => {
  const { catalogSummary } = await import("../server/admin/api.mjs");
  const { STATIC_PRODUCTS } = await import("../server/catalog/current.mjs");
  const live = { ...STATIC_PRODUCTS[0], slug: "night-shift-ss3000-maroon" };
  const summary = await catalogSummary(async () => ({ products: [...STATIC_PRODUCTS, live], liveProducts: [live] }));
  assert.equal(summary.products.length, STATIC_PRODUCTS.length + 1);
  const pet = summary.products.find((product) => product.slug === "pet-it-be-ss3000-maroon");
  assert.deepEqual({ price: pet.price, sizes: pet.sizes, source: pet.source, apliiqDesignId: pet.apliiqDesignId, url: pet.url }, { price: 55, sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"], source: "built", apliiqDesignId: 6211854, url: "/shop/pet-it-be-ss3000-maroon/" });
  assert.equal(summary.products.at(-1).source, "live");
});

test("the catalog route needs a signed-in session", async (t) => {
  const { sql } = await isolated(t);
  assert.equal((await call({ sql }, "catalog")).status, 401);
});
