import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { compareFeed, compareSquareCatalog, parseFeed } from "../server/operations/report.mjs";
import { latestReports, reportKey, runOwnerReport } from "../server/operations/runtime.mjs";
import operationsHealth, { config as healthSchedule } from "../netlify/functions/operations-health.mjs";
import weeklyDigestFunction, { config as digestSchedule } from "../netlify/functions/weekly-digest.mjs";

const MIGRATIONS = ["20261015045000_yikes_fulfillment", "20261015160000_custom_checkout", "20261015170000_order_notifications", "20261015180000_checkout_payment_recovery", "20261016100000_checkout_analytics_link", "20261016110000_product_drafts", "20261016120000_admin", "20261016130000_owner_reports"];
const CATALOG = {
  VAR1: { sku: "APQ-100S7A1", size: "M", priceCents: 5500, product: "crewneck", title: "Pet It Be Crewneck" },
  VAR2: { sku: "APQ-100S8A1", size: "L", priceCents: 5500, product: "crewneck", title: "Pet It Be Crewneck" },
};
const variation = (id, sku, amount, extra = {}) => ({ id, type: "ITEM_VARIATION", is_deleted: false, item_variation_data: { sku, price_money: { amount, currency: "USD" } }, ...extra });
const feed = (items) => `<rss><channel>${items.map(([id, price]) => `<item><g:id>${id}</g:id><g:price>${price} USD</g:price><g:shipping><g:country>US</g:country><g:price>0.00 USD</g:price></g:shipping></item>`).join("")}</channel></rss>`;
const env = (values) => ({ get: (key) => values[key] });

async function database(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of MIGRATIONS) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const sql = async (strings, ...parameters) => (await pg.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { pg, db: { sql } };
}

test("owner-report migration is identical at the repository and Netlify discovery paths", async () => {
  const name = "20261016130000_owner_reports";
  assert.equal(
    await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"),
    await readFile(new URL(`../../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"),
  );
});

test("Square drift names the exact size and what is wrong", () => {
  assert.deepEqual(compareSquareCatalog(CATALOG, [variation("VAR1", "APQ-100S7A1", 5500), variation("VAR2", "APQ-100S8A1", 5500)]), []);
  const problems = compareSquareCatalog(CATALOG, [variation("VAR1", "APQ-999S7A1", 5000)]);
  assert.equal(problems.length, 3);
  assert.match(problems[0], /Pet It Be Crewneck M SKU is APQ-999S7A1, expected APQ-100S7A1/);
  assert.match(problems[1], /price is \$50\.00, expected \$55\.00/);
  assert.match(problems[2], /L \(VAR2\) is missing or deleted/);
  assert.match(compareSquareCatalog(CATALOG, [variation("VAR1", "APQ-100S7A1", 5500), variation("VAR2", "APQ-100S8A1", 5500, { is_deleted: true })])[0], /missing or deleted/);
});

test("feed check reads the item price, not the nested shipping price, and flags extras", () => {
  assert.deepEqual([...parseFeed(feed([["VAR1", "55.00"]])).entries()], [["VAR1", 5500]]);
  assert.deepEqual(compareFeed(CATALOG, feed([["VAR1", "55.00"], ["VAR2", "55.00"]]), "Google"), []);
  const problems = compareFeed(CATALOG, feed([["VAR1", "52.00"], ["GHOST", "10.00"]]), "Meta");
  assert.deepEqual(problems.map((line) => line.split(":")[0]), ["Meta feed", "Meta feed", "Meta feed"]);
  assert.match(problems.join("\n"), /shows \$52\.00, checkout charges \$55\.00/);
  assert.match(problems.join("\n"), /VAR2\) is missing/);
  assert.match(problems.join("\n"), /GHOST is advertised but can't be bought/);
  assert.deepEqual(compareFeed(CATALOG, "<rss></rss>", "Google"), ["Google feed: no products found."]);
});

test("a healthy day is recorded but sends no email; a broken day emails once", async (t) => {
  const { db } = await database(t);
  const sent = [];
  const mailer = { send: async (message) => { sent.push(message); return { id: `email-${sent.length}` }; } };
  const goodFetch = async () => new Response(feed([["VAR1", "55.00"], ["VAR2", "55.00"]]));
  const square = { batchRetrieve: async () => [variation("VAR1", "APQ-100S7A1", 5500), variation("VAR2", "APQ-100S8A1", 5500)] };
  const options = { db, env: env({ AHA_OWNER_EMAIL: "owner@example.com" }), mailer, catalog: CATALOG };

  const day1 = new Date("2026-10-17T13:00:00Z");
  const healthy = await runOwnerReport("daily_health", { ...options, square, fetchImpl: goodFetch, now: () => day1 });
  assert.deepEqual(healthy, { key: "health:2026-10-17", ok: true, emailed: false });
  assert.equal(sent.length, 0);
  assert.equal((await latestReports(db)).daily_health.ok, true);

  const day2 = new Date("2026-10-18T13:00:00Z");
  const brokenSquare = { batchRetrieve: async () => [variation("VAR1", "APQ-100S7A1", 5000)] };
  const brokenFeed = async () => new Response("down", { status: 503 });
  const broken = await runOwnerReport("daily_health", { ...options, square: brokenSquare, fetchImpl: brokenFeed, now: () => day2 });
  assert.equal(broken.emailed, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipient, "owner@example.com");
  assert.equal(sent[0].idempotencyKey, "aha-health:2026-10-18");
  assert.match(sent[0].text, /price is \$50\.00/);
  assert.match(sent[0].text, /Couldn't run the Google feed check \(HTTP 503\)/);
  assert.match(sent[0].subject, /need a look/);

  // A second scheduled run the same day never sends again.
  assert.deepEqual(await runOwnerReport("daily_health", { ...options, square: brokenSquare, fetchImpl: brokenFeed, now: () => day2 }), { key: "health:2026-10-18", skipped: true });
  assert.equal(sent.length, 1);
});

test("orders refunded after reaching Apliiq tell the owner to cancel there today", async (t) => {
  const { db, pg } = await database(t);
  await pg.query(`INSERT INTO aha_fulfillment_orders (square_order_id, square_payment_id, state, apliiq_order_id, last_error_code, provider_status, submitted_items) VALUES
    ('ORDER-REFUND', 'PAY-1', 'attention', 'APQ-ORDER-9', 'payment_refunded', 'attention', '[]'::jsonb),
    ('ORDER-OK', 'PAY-2', 'shipped', 'APQ-ORDER-10', NULL, 'shipped', '[]'::jsonb)`);
  const sent = [];
  const result = await runOwnerReport("daily_health", {
    db, env: env({ RESEND_REPLY_TO: "info@example.com" }), catalog: CATALOG,
    square: { batchRetrieve: async () => [variation("VAR1", "APQ-100S7A1", 5500), variation("VAR2", "APQ-100S8A1", 5500)] },
    fetchImpl: async () => new Response(feed([["VAR1", "55.00"], ["VAR2", "55.00"]])),
    mailer: { send: async (message) => { sent.push(message); return { id: "x" }; } },
    now: () => new Date(),
  });
  assert.equal(result.emailed, true);
  assert.equal(sent[0].recipient, "info@example.com", "falls back to the reply-to inbox");
  assert.match(sent[0].text, /ORDER-REFUND: refunded or cancelled in Square after it reached Apliiq \(APQ-ORDER-9\)\. Cancel it in the Apliiq dashboard today/);
  assert.doesNotMatch(sent[0].text, /ORDER-OK/);
});

test("weekly digest always sends: orders, revenue, best sellers and drop-off", async (t) => {
  const { db, pg } = await database(t);
  await pg.query(`INSERT INTO aha_fulfillment_orders (square_order_id, square_payment_id, state, submitted_items) VALUES
    ('O1', 'P1', 'shipped', '[{"title":"Pet It Be Crewneck","size":"M","quantity":2}]'::jsonb),
    ('O2', 'P2', 'shipped', '[{"title":"Yikes Crewneck","size":"L","quantity":1}]'::jsonb)`);
  const session = (id, state, cents, sessionId) => pg.query(`INSERT INTO aha_checkout_sessions (checkout_id, token_sha256, state, currency, cart_json, shipping_address_json, order_payload_json, subtotal_cents, shipping_cents, tax_cents, total_cents, order_idempotency_key, expires_at, posthog_session_id)
    VALUES ($1, $1, $2, 'USD', '[]', '{}', '{}', $3, 0, 0, $3, $1, now() + interval '1 hour', $4)`, [id, state, cents, sessionId]);
  await session("c1", "completed", 11000, "s1");
  await session("c2", "completed", 5200, "s2");
  await session("c3", "quoted", 5500, "s3");
  const sent = [];
  const result = await runOwnerReport("weekly_digest", {
    db, env: env({ AHA_OWNER_EMAIL: "owner@example.com", PUBLIC_POSTHOG_PROJECT_URL: "https://us.posthog.com/project/1" }),
    mailer: { send: async (message) => { sent.push(message); return { id: "digest-1" }; } },
    now: () => new Date("2026-10-19T13:30:00Z"),
  });
  assert.deepEqual(result, { key: "digest:2026-10-19", ok: true, emailed: true });
  assert.equal(sent[0].subject, "2 orders, $162.00 this week");
  assert.match(sent[0].text, /3 pieces sold\. Best: Pet It Be Crewneck \(2\), Yikes Crewneck \(1\)\./);
  assert.match(sent[0].text, /Checkouts started: 3\. Paid: 2 \(67%\)\. Abandoned: 1\./);
  assert.match(sent[0].text, /Trends and recordings in PostHog: https:\/\/us\.posthog\.com\/project\/1/);
  assert.equal((await latestReports(db)).weekly_digest.emailedAt !== null, true);
});

test("owner reports run only on the exact production site, on their schedules", async () => {
  assert.equal(healthSchedule.schedule, "0 13 * * *");
  assert.equal(digestSchedule.schedule, "30 13 * * 1");
  globalThis.Netlify = { env: { get: () => { throw new Error("must not read env off-site"); } } };
  try {
    assert.equal(await operationsHealth(new Request("https://example.com"), { site: { id: "other" }, deploy: { context: "production" } }), undefined);
    assert.equal(await weeklyDigestFunction(new Request("https://example.com"), { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "deploy-preview" } }), undefined);
  } finally { delete globalThis.Netlify; }
  assert.equal(reportKey("weekly_digest", new Date("2026-10-19T13:30:00Z")), "digest:2026-10-19");
});
