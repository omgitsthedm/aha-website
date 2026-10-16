import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { handleAdmin } from "../server/admin/api.mjs";
import { SESSION_COOKIE } from "../server/admin/auth.mjs";
import { handleSubscribe, normalizeEmail, SIGNUP_CONSENT } from "../server/updates/signups.mjs";
import subscribeFunction, { config } from "../netlify/functions/updates-subscribe.mjs";

const ORIGIN = "https://afterhoursagenda.com";
const MIGRATION = "20261016140000_email_signups";

async function database(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of ["20261016120000_admin", MIGRATION]) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const sql = async (strings, ...parameters) => (await pg.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { pg, db: { sql } };
}

const post = (body, headers = {}) => new Request(`${ORIGIN}/api/updates/subscribe`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { origin: ORIGIN, "content-type": "application/json", ...headers } });
const subscribe = async (db, body, headers, clientKey = "203.0.113.5") => {
  const response = await handleSubscribe(post(body, headers), { db, clientKey });
  return { status: response.status, body: await response.json() };
};
const rows = (pg) => pg.query("SELECT email, source, consent_text FROM aha_email_signups ORDER BY id").then((result) => result.rows);

test("the sign-up migration is identical at both discovery paths", async () => {
  assert.equal(
    await readFile(new URL(`../netlify/database/migrations/${MIGRATION}/migration.sql`, import.meta.url), "utf8"),
    await readFile(new URL(`../../netlify/database/migrations/${MIGRATION}/migration.sql`, import.meta.url), "utf8"),
  );
});

test("addresses are checked and stored lowercased", () => {
  assert.equal(normalizeEmail("  Name@Example.COM "), "name@example.com");
  for (const bad of ["", "name", "name@", "@example.com", "name@example", "name@example.c", "a b@example.com", 42, null, `${"a".repeat(250)}@example.com`]) assert.equal(normalizeEmail(bad), null, String(bad));
});

test("a sign-up stores the address, its page and the wording shown; repeats look the same", async (t) => {
  const { db, pg } = await database(t);
  assert.deepEqual(await subscribe(db, { email: "Fan@Example.com", source: "home" }), { status: 200, body: { ok: true } });
  assert.deepEqual(await subscribe(db, { email: "fan@example.com", source: "updates" }), { status: 200, body: { ok: true } }, "an address already on the list gets the same reply");
  assert.deepEqual(await rows(pg), [{ email: "fan@example.com", source: "home", consent_text: SIGNUP_CONSENT }]);
  await subscribe(db, { email: "second@example.com", source: "<script>" });
  assert.equal((await rows(pg))[1].source, "site", "an unexpected source is replaced");
});

test("bad input, other sites and filled-in trap fields store nothing", async (t) => {
  const { db, pg } = await database(t);
  assert.equal((await subscribe(db, { email: "not-an-address" })).status, 422);
  assert.equal((await subscribe(db, { email: "fan@example.com" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await subscribe(db, { email: "fan@example.com" }, { "content-type": "text/plain" })).status, 415);
  assert.equal((await subscribe(db, "{nope")).status, 400);
  assert.equal((await subscribe(db, { email: "fan@example.com", padding: "x".repeat(3000) })).status, 413);
  assert.deepEqual(await subscribe(db, { email: "bot@example.com", company: "Acme" }), { status: 200, body: { ok: true } }, "a bot sees success");
  assert.equal((await handleSubscribe(new Request(`${ORIGIN}/api/updates/subscribe`), { db })).status, 404);
  assert.deepEqual(await rows(pg), []);
});

test("one connection gets eight tries an hour, stored only as a hash", async (t) => {
  const { db, pg } = await database(t);
  for (let index = 0; index < 8; index += 1) assert.equal((await subscribe(db, { email: `fan${index}@example.com` })).status, 200);
  assert.equal((await subscribe(db, { email: "fan9@example.com" })).status, 429);
  assert.equal((await subscribe(db, { email: "fan9@example.com" }, {}, "198.51.100.7")).status, 200, "another connection is unaffected");
  const keys = (await pg.query("SELECT DISTINCT client_key FROM aha_signup_attempts")).rows.map((row) => row.client_key);
  assert.ok(keys.every((key) => /^[0-9a-f]{64}$/.test(key)));
  assert.ok(!keys.includes("203.0.113.5"));
});

test("the function answers only on the exact production site", async () => {
  assert.equal(config.path, "/api/updates/subscribe");
  for (const [url, context] of [
    [`${ORIGIN}/api/updates/subscribe`, { site: { id: "another-site" }, deploy: { context: "production" } }],
    [`${ORIGIN}/api/updates/subscribe`, { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "deploy-preview" } }],
    ["https://a-preview.netlify.app/api/updates/subscribe", { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "production" } }],
  ]) assert.equal((await subscribeFunction(new Request(url, { method: "POST", body: "{}" }), context)).status, 404);
});

test("the admin email list needs a session, removes by id and keeps addresses out of the audit log", async (t) => {
  const { db, pg } = await database(t);
  const env = { get: (key) => ({ ADMIN_ORIGIN: ORIGIN })[key] };
  const call = (path, { method = "GET", cookie } = {}) => handleAdmin(new Request(`${ORIGIN}/api/admin/${path}`, { method, headers: { ...(method === "GET" ? {} : { origin: ORIGIN, "x-aha-admin": "1" }), ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}) } }), { db, env, context: { ip: "203.0.113.9" } }).then(async (response) => ({ status: response.status, body: await response.json() }));
  assert.equal((await call("signups")).status, 401);
  assert.equal((await call("signups/1/remove", { method: "POST" })).status, 401);
  await subscribe(db, { email: "one@example.com", source: "home" });
  await subscribe(db, { email: "two@example.com", source: "updates" });
  await pg.query(`INSERT INTO aha_admin_users (id, email) VALUES ('adm_1', 'info@afterhoursagenda.com')`);
  await pg.query(`INSERT INTO aha_admin_sessions (token_sha256, user_id, expires_at) VALUES ($1, 'adm_1', now() + interval '1 hour')`, [createHash("sha256").update("tok").digest("hex")]);
  const list = await call("signups", { cookie: "tok" });
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 2);
  assert.equal(list.body.last7Days, 2);
  assert.deepEqual(list.body.signups.map((entry) => [entry.email, entry.source]), [["two@example.com", "updates"], ["one@example.com", "home"]]);
  const target = list.body.signups[0].id;
  assert.deepEqual((await call(`signups/${target}/remove`, { method: "POST", cookie: "tok" })).body, { removed: true });
  assert.deepEqual((await call(`signups/${target}/remove`, { method: "POST", cookie: "tok" })).body, { removed: false });
  assert.deepEqual((await rows(pg)).map((row) => row.email), ["one@example.com"]);
  const audit = (await pg.query(`SELECT target, detail_json::text AS detail FROM aha_admin_audit WHERE action = 'signup.removed'`)).rows;
  assert.equal(audit.length, 2);
  assert.ok(audit.every((row) => row.target === target && !row.detail.includes("@")));
});

test("before the sign-up migration is applied, the admin overview, list and digest still work", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of ["20261015045000_yikes_fulfillment", "20261016110000_product_drafts", "20261016120000_admin", "20261016130000_owner_reports"]) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const db = { sql: async (strings, ...parameters) => (await pg.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows };
  const { listSignups, signupCounts } = await import("../server/updates/signups.mjs");
  assert.deepEqual(await signupCounts(db), { total: 0, last7Days: 0 });
  assert.deepEqual(await listSignups(db), { total: 0, last7Days: 0, signups: [] });
  await pg.query(`INSERT INTO aha_admin_users (id, email) VALUES ('adm_1', 'info@afterhoursagenda.com')`);
  await pg.query(`INSERT INTO aha_admin_sessions (token_sha256, user_id, expires_at) VALUES ($1, 'adm_1', now() + interval '1 hour')`, [createHash("sha256").update("tok").digest("hex")]);
  const overview = await handleAdmin(new Request(`${ORIGIN}/api/admin/overview`, { headers: { cookie: `${SESSION_COOKIE}=tok` } }), { db, env: { get: (key) => ({ ADMIN_ORIGIN: ORIGIN })[key] }, context: {} });
  assert.equal(overview.status, 200);
  assert.deepEqual((await overview.json()).signups, { total: 0, last7Days: 0 });
  // Other database errors still surface.
  await assert.rejects(signupCounts({ sql: async () => { throw Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }); } }), /connection refused/);
});

test("without the sign-up tables a visitor gets a plain reply and the daily check reports it", async (t) => {
  const { SIGNUP_UNAVAILABLE, signupProblems } = await import("../server/updates/signups.mjs");
  const bare = new PGlite();
  t.after(() => bare.close());
  const db = { sql: async (strings, ...parameters) => (await bare.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows };
  assert.deepEqual(await subscribe(db, { email: "fan@example.com" }), { status: 503, body: { error: SIGNUP_UNAVAILABLE } });
  assert.match((await signupProblems(db))[0], /sign-up tables don't exist/);
  const { db: ready } = await database(t);
  assert.deepEqual(await signupProblems(ready), []);
});

test("the hosted driver's wrapped errors are recognized, and logs never carry query parameters", async () => {
  const { errorSummary, missingTable, signupCounts } = await import("../server/updates/signups.mjs");
  const wrapped = (code, message) => Object.assign(new Error("Failed query: INSERT INTO aha_email_signups (email) VALUES ($1)\nparams: fan@example.com"), { cause: Object.assign(new Error(message), { name: "NeonDbError", code }) });
  const missing = wrapped("42P01", 'relation "aha_email_signups" does not exist');
  assert.equal(missingTable(missing), true);
  assert.equal(missingTable(wrapped("57P01", "terminating connection")), false);
  assert.deepEqual(await signupCounts({ sql: async () => { throw missing; } }), { total: 0, last7Days: 0 });
  const response = await handleSubscribe(post({ email: "fan@example.com" }), { db: { sql: async () => { throw missing; } } });
  assert.equal(response.status, 503);
  assert.equal(errorSummary(missing), "Error <- NeonDbError 42P01");
  assert.doesNotMatch(errorSummary(missing), /@|params/);
});
