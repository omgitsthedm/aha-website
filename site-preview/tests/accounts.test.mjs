import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import products from "../src/data/products.json" with { type: "json" };
import { handleFeeds } from "../netlify/functions/catalog-feeds.mjs";
import { handleAdmin } from "../server/admin/api.mjs";
import { SESSION_COOKIE } from "../server/admin/auth.mjs";
import { DROPS, dropNote, dropProblems, dropStage, lockedVariations, releasedProducts, secondsToNextRelease } from "../server/catalog/drops.mjs";
import { cleanSaved, handleAccount, MAX_SAVED } from "../server/customers/api.mjs";
import { ACCOUNT_COOKIE } from "../server/customers/auth.mjs";
import { earlyAccessLocks } from "../server/customers/early-access.mjs";
import { handleReviews } from "../server/customers/reviews-api.mjs";
import { cleanReview, publicReviews } from "../server/customers/reviews.mjs";
import { orderToken } from "../server/orders/status.mjs";
import { hkdfSync } from "node:crypto";

const ORIGIN = "https://afterhoursagenda.com";
const SECRET = "order-link-secret-for-account-tests";
const env = { get: (key) => ({ ACCOUNT_ORIGIN: ORIGIN, ADMIN_ORIGIN: ORIGIN, AHA_ORDER_LINK_SECRET: SECRET })[key] };
const token = (orderId) => orderToken(orderId, Buffer.from(hkdfSync("sha256", SECRET, "aha-order-link", "order-status-v1", 32)));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const catalog = async () => ({ products });
const crew = products.find((product) => product.slug === "yikes-crewneck");
const hoodie = products.find((product) => product.slug === "yikes-cropped-hoodie");

async function isolated(t) {
  const database = new PGlite(); t.after(() => database.close());
  const dir = new URL("../netlify/database/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter((entry) => entry >= "20261015").sort()) await database.exec(await readFile(new URL(`${name}/migration.sql`, dir), "utf8"));
  return { sql: async (strings, ...values) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), values)).rows };
}
async function order(db, id, { state = "shipped", items = [crew] } = {}) {
  await db.sql`INSERT INTO aha_fulfillment_orders (square_order_id, state, submitted_items, tracking, apliiq_payload) VALUES (${id}, ${state}, ${JSON.stringify(items.map((product) => ({ variationId: product.variants[0].id, sku: product.variants[0].sku, size: product.variants[0].size, quantity: 1, title: product.title })))}, ${state === "shipped" ? '[{"carrier":"USPS","number":"9400"}]' : "[]"}, ${JSON.stringify({ order_number: `N-${id}` })})`;
}
async function customer(db, id = "cus_1") {
  await db.sql`INSERT INTO aha_customers (id) VALUES (${id})`;
  const session = `session-${id}`;
  await db.sql`INSERT INTO aha_customer_sessions (token_sha256, customer_id, expires_at) VALUES (${hash(session)}, ${id}, now() + interval '1 day')`;
  return session;
}
const account = (db, path, { method = "GET", body, session, headers } = {}) => handleAccount(new Request(`${ORIGIN}/api/account/${path}`, {
  method, body: body === undefined ? undefined : JSON.stringify(body),
  headers: { ...(method === "GET" ? {} : { origin: ORIGIN, "x-aha-account": "1" }), ...(session ? { cookie: `${ACCOUNT_COOKIE}=${session}` } : {}), ...headers },
}), { db, env, context: { ip: "198.51.100.7" }, catalog }).then(async (response) => ({ status: response.status, body: await response.json(), headers: response.headers }));

test("the accounts migration is identical at both discovery paths", async () => {
  const name = "20261019100000_customer_accounts";
  assert.equal(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"), await readFile(new URL(`../../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
});

test("drops: the data file is valid, and early access opens only to signed-in account holders", () => {
  assert.deepEqual(dropProblems(DROPS, products), []);
  assert.deepEqual(dropProblems([{ slug: "nope", earlyAccessAt: "2026-11-07T15:00:00Z", releaseAt: "2026-11-06T15:00:00Z" }], products), ["nope is not a product.", "nope: early access must open before the release."]);
  assert.match(dropProblems([{ slug: crew.slug, earlyAccessAt: "tomorrow", releaseAt: "2026-11-06T15:00:00Z" }])[0], /UTC times/);
  const drop = { slug: crew.slug, earlyAccessAt: "2026-11-06T15:00:00Z", releaseAt: "2026-11-07T15:00:00Z" };
  const drops = [drop];
  const before = Date.parse("2026-11-05T00:00:00Z"), early = Date.parse("2026-11-06T16:00:00Z"), after = Date.parse("2026-11-07T15:00:00Z");
  assert.deepEqual([dropStage(drop, before), dropStage(drop, early), dropStage(drop, after), dropStage(null)], ["upcoming", "early", "released", null]);
  const crewIds = crew.variants.map((variant) => variant.id).sort();
  assert.deepEqual([...lockedVariations(products, { now: before, signedIn: true, drops })].sort(), crewIds);
  assert.deepEqual([...lockedVariations(products, { now: early, signedIn: false, drops })].sort(), crewIds);
  assert.equal(lockedVariations(products, { now: early, signedIn: true, drops }).size, 0);
  assert.equal(lockedVariations(products, { now: after, signedIn: false, drops }).size, 0);
  assert.equal(releasedProducts(products, early, drops).some((product) => product.slug === crew.slug), false);
  assert.equal(releasedProducts(products, after, drops).length, products.length);
  assert.equal(secondsToNextRelease(early, drops), 82800);
  assert.equal(secondsToNextRelease(after, drops), null);
  assert.match(dropNote(drop), /^Account holders can buy it from Fri, Nov 6, 10:00\sAM EST\. Everyone can from Sat, Nov 7, 10:00\sAM EST\.$/);
});

test("drops: checkout asks for the account only while a drop is pending, and a failed lookup locks", async (t) => {
  const db = await isolated(t);
  const session = await customer(db);
  const drops = [{ slug: crew.slug, earlyAccessAt: "2026-11-06T15:00:00Z", releaseAt: "2026-11-07T15:00:00Z" }];
  const early = Date.parse("2026-11-06T16:00:00Z");
  const request = (cookie) => new Request(`${ORIGIN}/api/checkout/quote`, { method: "POST", headers: cookie ? { cookie: `${ACCOUNT_COOKIE}=${cookie}` } : {} });
  let asked = 0;
  const counting = () => { asked += 1; return db; };
  assert.equal((await earlyAccessLocks(request(session), products, { db: counting, now: early, drops: [] })).size, 0);
  assert.equal(asked, 0, "no drop, no database lookup");
  assert.equal((await earlyAccessLocks(request(session), products, { db: counting, now: early, drops })).size, 0);
  assert.equal((await earlyAccessLocks(request(), products, { db: counting, now: early, drops })).size, crew.variants.length);
  assert.equal((await earlyAccessLocks(request("not-a-session"), products, { db: counting, now: early, drops })).size, crew.variants.length);
  assert.equal((await earlyAccessLocks(request(session), products, { db: () => { throw new Error("database down"); }, now: early, drops })).size, crew.variants.length);
});

test("drops: feeds leave out a pending drop and expire at its release", async () => {
  const drops = [{ slug: crew.slug, earlyAccessAt: "2026-11-06T15:00:00Z", releaseAt: "2026-11-07T15:00:00Z" }];
  const feed = (now) => handleFeeds(new Request(`${ORIGIN}/feeds/google.xml`), { deploy: { context: "production" } }, { catalog: async () => ({ saleProducts: products, saleLiveProducts: [] }), drops, now });
  const pending = await feed(Date.parse("2026-11-07T14:00:00Z"));
  const body = await pending.text();
  assert.ok(!body.includes(crew.variants[0].id) && body.includes(hoodie.variants[0].id));
  assert.equal(pending.headers.get("netlify-cdn-cache-control"), "public, durable, s-maxage=3600");
  const released = await feed(Date.parse("2026-11-07T15:00:01Z"));
  assert.ok((await released.text()).includes(crew.variants[0].id));
  assert.match(released.headers.get("netlify-cdn-cache-control"), /s-maxage=31536000/);
});

test("accounts: signed out, cross-site blocked, options issue a one-time challenge, and attempts are limited", async (t) => {
  const db = await isolated(t);
  assert.deepEqual((await account(db, "me")).body, { signedIn: false });
  assert.equal((await account(db, "saved", { method: "PUT", body: { saved: [] } })).status, 401);
  assert.equal((await account(db, "auth/register/options", { method: "POST", headers: { origin: "https://evil.example" } })).status, 403);
  assert.equal((await account(db, "auth/register/options", { method: "POST", headers: { "x-aha-account": "" } })).status, 403);
  const { status, body } = await account(db, "auth/register/options", { method: "POST" });
  assert.equal(status, 200);
  assert.equal(body.options.rp.id, "afterhoursagenda.com");
  assert.equal(body.options.authenticatorSelection.residentKey, "required");
  assert.match(body.options.user.name, /^After Hours Agenda [0-9A-F]{6}$/);
  const [stored] = await db.sql`SELECT id_sha256, challenge FROM aha_customer_challenges`;
  assert.equal(stored.id_sha256, hash(body.handle), "only the handle's hash is stored");
  assert.equal(stored.challenge, body.options.challenge);
  assert.deepEqual((await account(db, "auth/register/verify", { method: "POST", body: { handle: "wrong", response: {} } })).body, { error: "That took too long. Try again." });
  const login = await account(db, "auth/login/options", { method: "POST" });
  assert.deepEqual((await account(db, "auth/login/verify", { method: "POST", body: { handle: login.body.handle, response: { id: "unknown" } } })).body, { error: "That passkey isn't linked to an account here. Create an account instead." });
  // Four attempts so far; the limit is 30 in 15 minutes.
  for (let attempt = 0; attempt < 26; attempt += 1) assert.equal((await account(db, "auth/login/options", { method: "POST" })).status, 200);
  assert.equal((await account(db, "auth/login/options", { method: "POST" })).status, 429);
});

test("accounts: saved pieces, orders from private links, and deletion", async (t) => {
  const db = await isolated(t);
  const session = await customer(db);
  const other = await customer(db, "cus_2");
  assert.deepEqual((await account(db, "me", { session })).body, { signedIn: true, saved: [], orders: [] });
  assert.deepEqual(cleanSaved(["x", crew.slug, crew.slug, hoodie.slug, 4], products), [crew.slug, hoodie.slug]);
  assert.equal(cleanSaved(Array.from({ length: 80 }, () => products.map((product) => product.slug)).flat(), products).length, Math.min(MAX_SAVED, products.length));
  assert.deepEqual((await account(db, "saved", { method: "PUT", session, body: { saved: [hoodie.slug, "gone", crew.slug] } })).body, { saved: [hoodie.slug, crew.slug] });
  assert.deepEqual((await account(db, "saved", { method: "PUT", session, body: { saved: [crew.slug] } })).body, { saved: [crew.slug] });
  assert.deepEqual((await account(db, "me", { session })).body.saved, [crew.slug]);

  await order(db, "ORDER0000001", { state: "submitted" });
  assert.equal((await account(db, "orders", { method: "POST", session, body: { o: "ORDER0000001", k: "wrong" } })).status, 404);
  assert.equal((await account(db, "orders", { method: "POST", session, body: { o: "ORDER0000404", k: token("ORDER0000404") } })).status, 404);
  assert.equal((await account(db, "orders", { method: "POST", session, body: { o: "ORDER0000001", k: token("ORDER0000001") } })).status, 200);
  assert.equal((await account(db, "orders", { method: "POST", session, body: { o: "ORDER0000001", k: token("ORDER0000001") } })).status, 200, "adding twice is fine");
  assert.deepEqual((await account(db, "orders", { method: "POST", session: other, body: { o: "ORDER0000001", k: token("ORDER0000001") } })).body, { error: "This order is already in another account." });
  const [listed] = (await account(db, "me", { session })).body.orders;
  assert.equal(listed.orderNumber, "N-ORDER0000001");
  assert.equal(listed.stage, "production");
  assert.equal(listed.url, `/order/?o=ORDER0000001&k=${token("ORDER0000001")}`);
  assert.equal(JSON.stringify(listed).includes("@"), false);

  const deleted = await account(db, "me", { method: "DELETE", session });
  assert.deepEqual(deleted.body, { deleted: true });
  assert.match(deleted.headers.get("set-cookie"), /Max-Age=0/);
  for (const table of ["aha_customer_sessions", "aha_customer_saved", "aha_customer_orders"]) {
    const [row] = await db.sql([`SELECT count(*) AS n FROM ${table} WHERE customer_id = 'cus_1'`]);
    assert.equal(Number(row.n), 0, table);
  }
  assert.deepEqual((await account(db, "me", { session })).body, { signedIn: false });
  assert.equal((await account(db, "me", { session: other })).body.signedIn, true, "other accounts are untouched");
});

test("reviews: only shipped orders, only their pieces, plain checks on what's written", async (t) => {
  const db = await isolated(t);
  await order(db, "ORDERSHIPPED", { items: [crew, hoodie] });
  await order(db, "ORDERMAKING1", { state: "submitted" });
  const review = (body, headers = { origin: ORIGIN, "x-aha-review": "1" }) => handleReviews(new Request(`${ORIGIN}/api/reviews/order`, { method: "POST", body: JSON.stringify(body), headers }), { db, env, catalog }).then(async (response) => ({ status: response.status, body: await response.json() }));
  const offered = await handleReviews(new Request(`${ORIGIN}/api/reviews/order?o=ORDERSHIPPED&k=${token("ORDERSHIPPED")}`), { db, env, catalog }).then((response) => response.json());
  assert.equal(offered.open, true);
  assert.deepEqual(offered.products.map((product) => product.slug), [crew.slug, hoodie.slug]);
  const making = await handleReviews(new Request(`${ORIGIN}/api/reviews/order?o=ORDERMAKING1&k=${token("ORDERMAKING1")}`), { db, env, catalog }).then((response) => response.json());
  assert.equal(making.open, false);

  const link = { o: "ORDERSHIPPED", k: token("ORDERSHIPPED") };
  assert.equal((await review({ ...link, product: crew.slug, rating: 5, body: "Great" }, { origin: ORIGIN })).status, 403);
  assert.equal((await review({ o: "ORDERSHIPPED", k: "nope", product: crew.slug, rating: 5, body: "Great" })).status, 404);
  assert.equal((await review({ o: "ORDERMAKING1", k: token("ORDERMAKING1"), product: crew.slug, rating: 5, body: "Great" })).status, 409);
  assert.equal((await review({ ...link, product: "the-city-ss4500-black", rating: 5, body: "Great" })).status, 404);
  assert.throws(() => cleanReview({ rating: 6, body: "Great" }), /one to five/);
  assert.throws(() => cleanReview({ rating: 4, body: " " }), /a few words/);
  assert.throws(() => cleanReview({ rating: 4, body: "x".repeat(601) }), /600/);
  assert.throws(() => cleanReview({ rating: 4, body: "Great", name: "sam@example.com" }), /first name or initials/);
  assert.throws(() => cleanReview({ rating: 4, body: "Great", name: "Call 555 0100" }), /first name or initials/);
  assert.deepEqual(cleanReview({ rating: 4, body: "  Soft.\n\n\n\nWarm.  ", name: "  Sam  R. " }), { rating: 4, body: "Soft.\n\nWarm.", name: "Sam R." });
  assert.deepEqual((await review({ ...link, product: crew.slug, rating: 5, body: "Heavy and soft.", name: "Sam" })).body, { product: crew.slug, status: "pending" });
  assert.deepEqual((await review({ ...link, product: hoodie.slug, rating: 3, body: "Runs short." })).body, { product: hoodie.slug, status: "pending" });
  assert.equal((await publicReviews(db, crew.slug)).count, 0, "nothing shows before approval");
});

test("reviews: the owner approves in the admin, the product page shows them, and an edit goes back for a read", async (t) => {
  const db = await isolated(t);
  await order(db, "ORDERSHIPPED", { items: [crew] });
  await order(db, "ORDERSHIPPD2", { items: [crew] });
  await db.sql`INSERT INTO aha_admin_users (id, email) VALUES ('adm_1', 'info@afterhoursagenda.com')`;
  await db.sql`INSERT INTO aha_admin_sessions (token_sha256, user_id, expires_at) VALUES (${hash("admin-session")}, 'adm_1', now() + interval '1 hour')`;
  const purged = [];
  const live = { purge: async (tags) => { purged.push(tags); return true; }, catalog };
  const admin = (path, method = "GET") => handleAdmin(new Request(`${ORIGIN}/api/admin/${path}`, { method, headers: { cookie: `${SESSION_COOKIE}=admin-session`, ...(method === "GET" ? {} : { origin: ORIGIN, "x-aha-admin": "1" }) } }), { db, env, context: { ip: "203.0.113.9" }, live }).then(async (response) => ({ status: response.status, body: await response.json() }));
  const submit = (o, rating, body) => handleReviews(new Request(`${ORIGIN}/api/reviews/order`, { method: "POST", body: JSON.stringify({ o, k: token(o), product: crew.slug, rating, body }), headers: { origin: ORIGIN, "x-aha-review": "1" } }), { db, env, catalog });
  await submit("ORDERSHIPPED", 5, "Heavy and soft.");
  await submit("ORDERSHIPPD2", 4, "Print is sharp.");

  const waiting = await admin("reviews");
  assert.deepEqual(waiting.body.counts, { pending: 2, approved: 0, rejected: 0 });
  assert.equal(waiting.body.reviews[0].order, "…HIPPD2");
  assert.equal((await admin("overview")).body.reviewsWaiting, 2);
  const [first, second] = waiting.body.reviews;
  assert.deepEqual((await admin(`reviews/${first.id}/approve`, "POST")).body, { product: crew.slug, status: "approved" });
  assert.deepEqual((await admin(`reviews/${second.id}/approve`, "POST")).body, { product: crew.slug, status: "approved" });
  assert.deepEqual(purged, [["reviews", `reviews-${crew.slug}`], ["reviews", `reviews-${crew.slug}`]]);
  assert.equal((await admin("reviews/999/approve", "POST")).status, 404);
  const audit = await db.sql`SELECT action FROM aha_admin_audit ORDER BY id`;
  assert.deepEqual(audit.map((row) => row.action), ["review.approve", "review.approve"]);

  const shown = await handleReviews(new Request(`${ORIGIN}/api/reviews?product=${crew.slug}`), { db, env, catalog });
  assert.equal(shown.headers.get("netlify-cache-tag"), `reviews,reviews-${crew.slug}`);
  const page = await shown.json();
  assert.equal(page.count, 2);
  assert.equal(page.average, 4.5);
  assert.deepEqual(page.reviews.map((entry) => [entry.rating, entry.body, entry.name]).sort(), [[4, "Print is sharp.", null], [5, "Heavy and soft.", null]]);
  assert.equal(JSON.stringify(page).includes("ORDER"), false, "order ids never reach the page");

  await submit("ORDERSHIPPED", 2, "Changed my mind.");
  assert.equal((await publicReviews(db, crew.slug)).count, 1, "the edit waits for approval again");
  assert.equal((await admin(`reviews/${first.id}/reject`, "POST")).body.status, "rejected");
  assert.equal((await publicReviews(db, crew.slug)).count, 0);
  assert.equal((await handleReviews(new Request(`${ORIGIN}/api/reviews?product=Not%20a%20slug`), { db, env, catalog })).status, 404);
});
