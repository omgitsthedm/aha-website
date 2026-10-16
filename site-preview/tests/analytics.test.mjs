import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { abandonedCartStats } from "../server/analytics/abandoned-carts.mjs";
import { checkoutProperties, createPostHogCapture, normalizeAnalyticsIds } from "../server/analytics/posthog.mjs";
import { createCheckoutRepository } from "../server/checkout/repository.mjs";

const migrations = [
  "20261015160000_custom_checkout",
  "20261015180000_checkout_payment_recovery",
  "20261016100000_checkout_analytics_link",
].map((name) => new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url));

async function isolated(t) {
  const database = new PGlite(); t.after(() => database.close());
  for (const file of migrations) await database.exec(await readFile(file, "utf8"));
  const sql = async (strings, ...parameters) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { database, sql, repository: createCheckoutRepository({ sql }) };
}
function record(checkoutId, analytics) {
  return { checkoutId, tokenHash: `hash-${checkoutId}`, currency: "USD", cart: [{ variationId: "VAR1", quantity: 2, unitAmount: 5500, totalAmount: 11000 }], address: { firstName: "A", lastName: "B", addressLine1: "1 Main", city: "Springfield", region: "NY", postalCode: "10001", country: "US", email: "a@example.com" }, orderPayload: { location_id: "TEST_LOCATION", line_items: [] }, subtotalCents: 11000, shippingCents: 0, taxCents: 0, totalCents: 11000, taxLabel: null, orderIdempotencyKey: `order-${checkoutId}`, expiresAt: "2030-01-01T00:00:00.000Z", analytics };
}

test("analytics ids accept only PostHog-shaped random ids", () => {
  assert.deepEqual(normalizeAnalyticsIds({ distinctId: "0192f1a2-abcd-7def-8123-456789abcdef", sessionId: "0192f1a2-0000-7000-8000-000000000001" }), { distinctId: "0192f1a2-abcd-7def-8123-456789abcdef", sessionId: "0192f1a2-0000-7000-8000-000000000001" });
  assert.deepEqual(normalizeAnalyticsIds({ distinctId: "jane@example.com", sessionId: "<script>" }), { distinctId: null, sessionId: null });
  assert.deepEqual(normalizeAnalyticsIds(undefined), { distinctId: null, sessionId: null });
  assert.equal(normalizeAnalyticsIds({ distinctId: "x".repeat(101) }).distinctId, null);
});

test("server capture is a no-op without a project key and never calls the network", async () => {
  let called = false;
  const capture = createPostHogCapture({ key: "", fetchImpl: async () => { called = true; return new Response(null); } });
  assert.equal(await capture("checkout_quoted", { distinctId: "abc" }), false);
  assert.equal(called, false);
});

test("server capture refuses non-HTTPS hosts and missing visitors", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response(null); };
  assert.equal(await createPostHogCapture({ key: "phc_test", host: "http://us.i.posthog.com", fetchImpl })("x", { distinctId: "abc" }), false);
  assert.equal(await createPostHogCapture({ key: "phc_test", fetchImpl })("x", {}), false);
  assert.equal(calls, 0);
});

test("server capture sends amounts and product ids only, tied to the replay session", async () => {
  let sent;
  const capture = createPostHogCapture({ key: "phc_test", fetchImpl: async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return new Response(null, { status: 200 }); }, now: () => new Date("2026-10-16T12:00:00Z") });
  const properties = checkoutProperties({ totalCents: 11000, items: [{ variationId: "VAR1", quantity: 2, size: "M", product: "Tee" }] });
  assert.equal(await capture("purchase_completed", { distinctId: "visitor-1", sessionId: "session-1" }, properties), true);
  assert.equal(sent.url, "https://us.i.posthog.com/i/v0/e/");
  assert.equal(sent.body.distinct_id, "visitor-1");
  assert.equal(sent.body.properties.$session_id, "session-1");
  assert.deepEqual(sent.body.properties.product_ids, ["VAR1"]);
  assert.equal(sent.body.properties.value, 110);
  assert.equal(sent.body.properties.item_count, 2);
  assert.doesNotMatch(JSON.stringify(sent.body), /example\.com|Main|Springfield/);
});

test("a failing analytics endpoint never throws", async () => {
  const capture = createPostHogCapture({ key: "phc_test", fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(await capture("checkout_quoted", { distinctId: "visitor-1" }), false);
});

test("checkout quotes store the visitor's anonymous ids for replay links", async (t) => {
  const { repository } = await isolated(t);
  const saved = await repository.create(record("checkout-ph-1", { distinctId: "visitor-1", sessionId: "session-1" }));
  assert.equal(saved.posthog_distinct_id, "visitor-1");
  assert.equal(saved.posthog_session_id, "session-1");
  const anonymous = await repository.create(record("checkout-ph-2", undefined));
  assert.equal(anonymous.posthog_distinct_id, null);
});

test("abandoned carts group repeat quotes from one visit and exclude completed visits", async (t) => {
  const { repository, sql } = await isolated(t);
  await repository.create(record("c1", { distinctId: "v1", sessionId: "s1" }));
  await repository.create(record("c2", { distinctId: "v1", sessionId: "s1" })); // same visit, address changed
  await repository.create(record("c3", { distinctId: "v2", sessionId: "s2" }));
  await sql`UPDATE aha_checkout_sessions SET state = 'completed' WHERE checkout_id = ${"c3"}`;
  await repository.create(record("c4", undefined)); // analytics off: grouped by checkout
  const stats = await abandonedCartStats(sql);
  assert.deepEqual(stats.last7Days, { carts: 3, completed: 1, abandoned: 2 });
  assert.equal(stats.recent.length, 2);
  assert.ok(stats.recent.some((cart) => cart.posthogSessionId === "s1"));
  assert.ok(!stats.recent.some((cart) => cart.checkoutId === "c3"));
});

test("PostHog loads only with a key, analytics consent and no Global Privacy Control", async () => {
  const source = await readFile(new URL("../src/scripts/tracking.ts", import.meta.url), "utf8");
  assert.match(source, /if\(value\.analytics&&!gpc&&posthogKey\)/);
  assert.match(source, /maskAllInputs:true/);
  assert.match(source, /disable_session_recording:!record/);
  assert.match(source, /kind==='posthog'\?\(!consent\.analytics\|\|gpc\)/);
});
