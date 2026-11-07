import { reliabilitySchema } from "./helpers/reliability-schema.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { Webhook } from "svix";
import { PGlite } from "@electric-sql/pglite";
import { receiveDelivery } from "../server/notifications/delivery.mjs";
import { commerceHealth, runCommerceMonitor } from "../server/operations/commerce.mjs";
import { trackWorker } from "../server/operations/worker.mjs";
import webhook from "../netlify/functions/resend-webhook.mjs";
import health from "../netlify/functions/commerce-health.mjs";
import monitor, { config as monitorSchedule } from "../netlify/functions/commerce-monitor.mjs";
import { config as mailSchedule } from "../netlify/functions/notification-dispatch.mjs";

const MIGRATIONS = ["20261015045000_yikes_fulfillment", "20261015160000_custom_checkout", "20261015170000_order_notifications", "20261015180000_checkout_payment_recovery", "20261016130000_owner_reports", "20261107020000_commerce_safeguards"];
const values = { AHA_CHECKOUT_ENABLED: "true", AHA_SQUARE_ACCESS_TOKEN: "test", AHA_SQUARE_APPLICATION_ID: "test", AHA_SQUARE_LOCATION_ID: "test", AHA_SQUARE_MERCHANT_ID: "test", AHA_SQUARE_WEBHOOK_SIGNATURE_KEY: "test", AHA_FULFILLMENT_ENABLED: "true", AHA_APLIIQ_API_KEY: "test", AHA_APLIIQ_SHARED_SECRET: "test", AHA_FULFILLMENT_START_AT: "2026-10-15T00:00:00Z", AHA_ORDER_EMAIL_ENABLED: "true", RESEND_API_KEY: "test", RESEND_FROM_EMAIL: "orders@example.com", RESEND_REPLY_TO: "owner@example.com", RESEND_WEBHOOK_SECRET: "test", AHA_COMMERCE_MONITOR_TOKEN: "test" };
const env = { get: (key) => values[key] };
const secret = `whsec_${randomBytes(32).toString("base64")}`;
const event = (type = "delivered", message = "email-1", created = new Date().toISOString()) => ({ type: `email.${type}`, created_at: created, data: { email_id: message, to: ["private@example.com"], subject: "Private customer subject" } });
function signed(payload, { id = "msg-1", date = new Date(), changedBody } = {}) {
  const body = JSON.stringify(payload);
  return new Request("https://afterhoursagenda.com/api/webhooks/resend", { method: "POST", headers: {
    "svix-id": id, "svix-timestamp": String(Math.floor(date.getTime() / 1000)), "svix-signature": new Webhook(secret).sign(id, date, body),
  }, body: changedBody ?? body });
}
async function database(t) {
  const pg = new PGlite(); t.after(() => pg.close());
  for (const migration of MIGRATIONS) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${migration}/migration.sql`, import.meta.url), "utf8"));
  await reliabilitySchema(pg);
  const sql = async (strings, ...parameters) => (await pg.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { pg, db: { sql } };
}
async function paid(pg, { id = "order-1", age = "1 hour", state = "completed" } = {}) {
  await pg.query(`INSERT INTO aha_checkout_sessions (checkout_id, token_sha256, state, currency, cart_json, shipping_address_json, order_payload_json, subtotal_cents, shipping_cents, tax_cents, total_cents, order_idempotency_key, expires_at, square_order_id, square_payment_id, updated_at)
    VALUES ($1, $1, $2, 'USD', '[]', '{}', '{}', 5800, 0, 470, 6270, $1, now(), $1, $1, now() - $3::interval)`, [id, state, age]);
}
async function receipt(pg, { order = "order-1", message = "email-1", age = "0 minutes" } = {}) {
  await pg.query(`INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json, state, provider_message_id, sent_at)
    VALUES ($1, 'order_confirmed', 'private@example.com', '{}', 'sent', $2, now() - $3::interval)`, [`${order}:order_confirmed`, message, age]);
}
const codes = (report) => report.problems.map((p) => p.code);

test("commerce migration is identical in both deployment discovery paths", async () => {
  assert.equal(await readFile(new URL(`../netlify/database/migrations/${MIGRATIONS.at(-1)}/migration.sql`, import.meta.url), "utf8"), await readFile(new URL(`../../netlify/database/migrations/${MIGRATIONS.at(-1)}/migration.sql`, import.meta.url), "utf8"));
});
test("signed delivery callbacks persist only metadata, deduplicate and can precede send acknowledgment", async (t) => {
  const { db, pg } = await database(t);
  const options = { secret, database: () => db };
  assert.equal((await receiveDelivery(signed(event()), options)).status, 202);
  assert.equal((await receiveDelivery(signed(event()), options)).status, 202);
  const stored = (await pg.query("SELECT * FROM aha_email_delivery_events")).rows;
  assert.equal(stored.length, 1); assert.equal(stored[0].event_type, "delivered");
  assert.doesNotMatch(JSON.stringify(stored), /private@example|Private customer/);
  await receipt(pg);
  assert.deepEqual(codes(await commerceHealth({ db, env })), []);
});
test("tampered, stale, missing signatures and oversized bodies cannot touch the database", async () => {
  const options = { secret, database: () => { throw new Error("database must not be accessed"); } };
  assert.equal((await receiveDelivery(signed(event(), { changedBody: JSON.stringify(event("failed")) }), options)).status, 403);
  assert.equal((await receiveDelivery(signed(event(), { date: new Date(Date.now() - 600_000) }), options)).status, 403);
  assert.equal((await receiveDelivery(new Request("https://example.com", { method: "POST", body: JSON.stringify(event()) }), options)).status, 403);
  assert.equal((await receiveDelivery(new Request("https://example.com", { method: "POST", body: "x".repeat(131_073) }), options)).status, 413);
});
test("unsupported engagement callbacks are ignored and persistence failure stays retryable", async () => {
  const options = { secret, database: () => { throw new Error("database unavailable"); } };
  assert.equal((await receiveDelivery(signed(event("opened")), options)).status, 202);
  assert.equal((await receiveDelivery(signed(event()), options)).status, 503);
  assert.equal((await receiveDelivery(signed(event("delivered", "email-1", "bad-date")), options)).status, 400);
});
test("delivery delay followed by delivery stays delivered despite a late old sent callback", async (t) => {
  const { db, pg } = await database(t); const options = { secret, database: () => db };
  await pg.exec("UPDATE aha_commerce_monitor SET created_at = now() - interval '2 hours'");
  await receipt(pg, { age: "1 hour" });
  const base = Date.now() - 60_000;
  for (const [id, type, offset] of [["delay", "delivery_delayed", 0], ["delivery", "delivered", 1000], ["old", "sent", -1000]])
    await receiveDelivery(signed(event(type, "email-1", new Date(base + offset).toISOString()), { id }), options);
  assert.deepEqual(codes(await commerceHealth({ db, env, checkMonitor: false })), []);
});
test("missing receipt and fulfillment are detected even though Square recorded completion", async (t) => {
  const { db, pg } = await database(t); await paid(pg);
  assert.deepEqual(codes(await commerceHealth({ db, env })), ["fulfillment_missing", "receipt_missing"]);
});
test("declined payments and fresh cancellation holds do not trigger false paid-order incidents", async (t) => {
  const { db, pg } = await database(t); await paid(pg, { state: "failed" });
  await paid(pg, { id: "order-2", age: "2 minutes" });
  await pg.exec("INSERT INTO aha_fulfillment_orders (square_order_id, state, payment_created_at) VALUES ('order-2', 'queued', now())");
  assert.deepEqual(codes(await commerceHealth({ db, env })), []);
});
test("supplier acceptance overdue is measured after the cancellation hold plus worker grace", async (t) => {
  const { db, pg } = await database(t);
  await pg.exec("INSERT INTO aha_fulfillment_orders (square_order_id, state, payment_created_at) VALUES ('order-1', 'queued', now() - interval '4 hours')");
  assert.deepEqual(codes(await commerceHealth({ db, env })), ["supplier_acceptance_overdue"]);
});
test("new bounced and unconfirmed receipts alert; older untracked receipts are excluded", async (t) => {
  const { db, pg } = await database(t); const options = { secret, database: () => db };
  await pg.exec("UPDATE aha_commerce_monitor SET created_at = now() - interval '2 hours'");
  await receipt(pg, { age: "1 hour" });
  await receipt(pg, { order: "old-order", message: "old-email", age: "1 day" });
  assert.deepEqual(codes(await commerceHealth({ db, env, checkMonitor: false })), ["receipt_delivery_unconfirmed"]);
  await receiveDelivery(signed(event("bounced")), options);
  assert.deepEqual(codes(await commerceHealth({ db, env, checkMonitor: false })), ["receipt_delivery_failed"]);
});
test("successful and failed workers have separate timestamps; stale starts cannot imply success", async (t) => {
  const { db, pg } = await database(t);
  await trackWorker(db, "notifications", async () => "done");
  await assert.rejects(trackWorker(db, "fulfillment", async () => { throw new Error("failure"); }));
  assert.deepEqual(codes(await commerceHealth({ db, env })), ["fulfillment_worker_failed"]);
  await pg.exec("UPDATE aha_commerce_workers SET last_succeeded_at = now() - interval '2 hours', last_started_at = now(), last_failed_at = NULL");
  assert.deepEqual(codes(await commerceHealth({ db, env })), ["fulfillment_worker_stale", "notifications_worker_stale", "square-recovery_worker_stale"]);
});
test("shipping mail awaiting retry or attention is detected without a provider message ID", async (t) => {
  const { db, pg } = await database(t);
  await pg.exec("INSERT INTO aha_order_notifications (dedupe_key, kind, recipient, payload_json, state, created_at) VALUES ('ship:order_shipped:1', 'order_shipped', 'private@example.com', '{}', 'pending', now() - interval '1 hour')");
  assert.deepEqual(codes(await commerceHealth({ db, env })), ["shipping_email_unsent"]);
  await pg.exec("UPDATE aha_order_notifications SET state = 'attention', created_at = now()");
  assert.deepEqual(codes(await commerceHealth({ db, env })), ["shipping_email_unsent"]);
  await pg.exec("UPDATE aha_order_notifications SET state = 'pending'");
  assert.deepEqual(codes(await commerceHealth({ db, env })), []);
});
test("new shipments with no notification are detected without flagging older untracked shipments", async (t) => {
  const { db, pg } = await database(t);
  await pg.exec("UPDATE aha_commerce_monitor SET created_at = now() - interval '2 hours'; INSERT INTO aha_fulfillment_orders (square_order_id, state, updated_at) VALUES ('ship', 'shipped', now() - interval '1 hour'), ('old', 'shipped', now() - interval '1 day')");
  const report = await commerceHealth({ db, env, checkMonitor: false });
  assert.deepEqual(report.problems, [{ code: "shipping_email_missing", count: 1 }]);
});
test("stopped commerce monitor is visible to the independent health endpoint", async (t) => {
  const { db, pg } = await database(t);
  await pg.exec("UPDATE aha_commerce_monitor SET created_at = now() - interval '1 hour'");
  assert.deepEqual(codes(await commerceHealth({ db, env })), ["commerce_monitor_stale"]);
});
test("commerce alerts deduplicate a continuing incident for six hours and require provider acknowledgment", async (t) => {
  const { db } = await database(t); const sent = [];
  const inspect = async () => ({ ok: false, problems: [{ code: "receipt_missing", count: 1 }] });
  const mailer = { send: async (message) => { sent.push(message); return { id: "owner-email" }; } };
  const start = new Date();
  assert.equal((await runCommerceMonitor({ db, env, inspect, mailer, now: () => start })).emailed, true);
  assert.equal((await runCommerceMonitor({ db, env, inspect, mailer, now: () => new Date(start.getTime() + 16 * 60_000) })).deduplicated, true);
  assert.equal(sent.length, 1); assert.equal(sent[0].recipient, "owner@example.com");
  await assert.rejects(runCommerceMonitor({ db, env, inspect, mailer: { send: async () => ({}) }, now: () => new Date(start.getTime() + 7 * 3_600_000) }), /not_acknowledged/);
});
test("a healthy monitoring run records a heartbeat without sending any message", async (t) => {
  const { db, pg } = await database(t);
  const result = await runCommerceMonitor({ db, env, mailer: { send: () => { throw new Error("must not email"); } } });
  assert.equal(result.ok, true); assert.equal(result.emailed, false);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_owner_reports WHERE kind = 'commerce_health'")).rows[0].n, 1);
});
test("a changed incident whose email fails can retry within the same monitoring interval", async (t) => {
  const { db } = await database(t);
  let code = "receipt_missing";
  const inspect = async () => ({ ok: false, problems: [{ code, count: 1 }] });
  const mailer = { send: async () => ({ id: "owner-email" }) };
  await runCommerceMonitor({ db, env, inspect, mailer });
  code = "fulfillment_missing";
  await assert.rejects(runCommerceMonitor({ db, env, inspect, mailer: { send: async () => { throw new Error("outage"); } } }), /outage/);
  assert.equal((await runCommerceMonitor({ db, env, inspect, mailer })).emailed, true);
});
test("a resolved incident that returns alerts again before the six-hour reminder", async (t) => {
  const { db, pg } = await database(t);
  let ok = false;
  const inspect = async () => ({ ok, problems: ok ? [] : [{ code: "receipt_missing", count: 1 }] });
  const mailer = { send: async () => ({ id: "owner-email" }) };
  await runCommerceMonitor({ db, env, inspect, mailer });
  await pg.exec("UPDATE aha_owner_reports SET emailed_at = now() - interval '1 minute'");
  ok = true;
  await runCommerceMonitor({ db, env, inspect, mailer });
  ok = false;
  assert.equal((await runCommerceMonitor({ db, env, inspect, mailer, now: () => new Date(Date.now() + 16 * 60_000) })).emailed, true);
});
test("new endpoints and scheduler are restricted to the exact production site and a read-only token", async () => {
  const context = { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "production" } };
  globalThis.Netlify = { env: { get: () => "correct-private-token" } };
  try {
    assert.equal((await health(new Request("https://afterhoursagenda.com/api/commerce/health"), context)).status, 401);
    assert.equal((await health(new Request("https://other.example/api/commerce/health"), context)).status, 404);
    assert.equal((await webhook(new Request("https://other.example/api/webhooks/resend"), context)).status, 404);
    assert.equal(await monitor(null, { ...context, deploy: { context: "deploy-preview" } }), undefined);
  } finally { delete globalThis.Netlify; }
  assert.equal(monitorSchedule.schedule, "7,22,37,52 * * * *");
  assert.equal(mailSchedule.schedule, "0,15,30,45 * * * *");
});

test('inactive optional carrier tracking does not create false outage alerts',async t=>{
  const {db,pg}=await database(t);
  await pg.query("INSERT INTO aha_fulfillment_orders(square_order_id,state) VALUES('TRACKING-OFF','shipped')");
  await pg.query("INSERT INTO aha_shipment_tracking(square_order_id,tracking_number,carrier,items,next_attempt_at) VALUES('TRACKING-OFF','T','UPS','[]',now()-interval '1 day')");
  assert.ok(!codes(await commerceHealth({db,env})).includes('carrier_tracking_needs_attention'));
  const active={get:key=>key==='AHA_TRACKING_ENABLED'?'true':env.get(key)};
  assert.ok(codes(await commerceHealth({db,env:active})).includes('carrier_tracking_needs_attention'));
});
