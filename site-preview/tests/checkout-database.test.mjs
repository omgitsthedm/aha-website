import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createCheckoutRepository } from "../server/checkout/repository.mjs";
import { createCheckoutService } from "../server/checkout/service.mjs";
import { createMarketingRepository } from "../server/analytics/marketing-repository.mjs";

const migration = new URL("../netlify/database/migrations/20261015160000_custom_checkout/migration.sql", import.meta.url);
const rootMigration = new URL("../../netlify/database/migrations/20261015160000_custom_checkout/migration.sql", import.meta.url);
const recoveryMigration = new URL("../netlify/database/migrations/20261015180000_checkout_payment_recovery/migration.sql", import.meta.url);
const rootRecoveryMigration = new URL("../../netlify/database/migrations/20261015180000_checkout_payment_recovery/migration.sql", import.meta.url);
const analyticsMigration = new URL("../netlify/database/migrations/20261016100000_checkout_analytics_link/migration.sql", import.meta.url);
const rootAnalyticsMigration = new URL("../../netlify/database/migrations/20261016100000_checkout_analytics_link/migration.sql", import.meta.url);
const marketingMigration = new URL("../netlify/database/migrations/20261018120000_marketing_purchase_outbox/migration.sql", import.meta.url);
const rootMarketingMigration = new URL("../../netlify/database/migrations/20261018120000_marketing_purchase_outbox/migration.sql", import.meta.url);
const tokenHash = (value) => createHash("sha256").update(value).digest("hex");

async function isolated(t) {
  const database = new PGlite(); t.after(() => database.close());
  await database.exec(await readFile(migration, "utf8"));
  await database.exec(await readFile(recoveryMigration, "utf8"));
  await database.exec(await readFile(analyticsMigration, "utf8"));
  await database.exec(await readFile(marketingMigration, "utf8"));
  const sql = async (strings, ...parameters) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { database, sql, repository: createCheckoutRepository({ sql }), marketing: createMarketingRepository({ sql }) };
}
async function isolatedBeforeMarketing(t) {
  const database = new PGlite(); t.after(() => database.close());
  await database.exec(await readFile(migration, "utf8"));
  await database.exec(await readFile(recoveryMigration, "utf8"));
  await database.exec(await readFile(analyticsMigration, "utf8"));
  const sql = async (strings, ...parameters) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { repository: createCheckoutRepository({ sql }) };
}
function record({ checkoutId = "checkout-db-1", token = "test-token", expiresAt = "2030-01-01T00:00:00.000Z" } = {}) {
  return { checkoutId, tokenHash: tokenHash(token), currency: "USD", cart: [{ variationId: "R5UCZCGSJMR3Z4HJDVOD3ZIK", quantity: 1, unitAmount: 5200, totalAmount: 5200 }], address: { firstName: "A", lastName: "B", addressLine1: "1 Main", city: "New York", region: "NY", postalCode: "10001", country: "US", email: "a@example.com" }, orderPayload: { location_id: "TEST_LOCATION", line_items: [] }, subtotalCents: 5200, shippingCents: 0, taxCents: 0, totalCents: 5200, taxLabel: null, orderIdempotencyKey: `order-${checkoutId}`, expiresAt };
}

test("checkout migration remains identical at repository and Netlify discovery paths", async () => {
  assert.equal(await readFile(migration, "utf8"), await readFile(rootMigration, "utf8"));
  assert.equal(await readFile(recoveryMigration, "utf8"), await readFile(rootRecoveryMigration, "utf8"));
  assert.equal(await readFile(analyticsMigration, "utf8"), await readFile(rootAnalyticsMigration, "utf8"));
  assert.equal(await readFile(marketingMigration, "utf8"), await readFile(rootMarketingMigration, "utf8"));
});

test("a not-yet-applied marketing migration never blocks a checkout record", async (t) => {
  const { repository } = await isolatedBeforeMarketing(t);
  const saved = record({ checkoutId: "checkout-before-marketing" });
  await repository.create(saved);
  assert.equal(await repository.saveMarketing({ checkoutId: saved.checkoutId, context: { paymentConsentConfirmed: false } }), null);
  assert.equal((await repository.get(saved.checkoutId)).checkout_id, saved.checkoutId);
});

test("future checkout attribution and purchase outbox are durable and dedupe by provider plus Square order", async (t) => {
  const { repository, marketing, sql } = await isolated(t);
  const saved = record({ checkoutId: "checkout-marketing" });
  await repository.create(saved);
  await repository.saveMarketing({ checkoutId: saved.checkoutId, context: { analytics: { consent: true, gaClientId: "123.456" }, marketing: { consent: true, gpc: false, meta: {} } } });
  await repository.complete({ checkoutId: saved.checkoutId, orderId: "square-marketing", paymentId: "payment-marketing" });
  const checkout = await marketing.getCompletedCheckout(saved.checkoutId);
  assert.equal(checkout.marketing_json.analytics.gaClientId, "123.456");
  await marketing.enqueue({ provider: "google", squareOrderId: "square-marketing", checkoutId: saved.checkoutId, payload: { orderId: "square-marketing" } });
  await marketing.enqueue({ provider: "google", squareOrderId: "square-marketing", checkoutId: saved.checkoutId, payload: { orderId: "changed-but-ignored" } });
  const claimed = await marketing.claim(8);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].payload_json.orderId, "square-marketing");
  await marketing.retryOrAttention({ id: claimed[0].id, code: "google_http_503", retryAfterMinutes: 1 });
  assert.equal((await marketing.claim(8)).length, 0);
  await sql`UPDATE aha_marketing_purchase_outbox SET state = 'sending', lease_expires_at = now() - interval '1 second', next_attempt_at = now() - interval '1 second', attempt_count = 1 WHERE id = ${claimed[0].id}`;
  assert.equal((await marketing.claim(8)).length, 1);
});

test("an expired delivery worker cannot overwrite a newer marketing lease", async (t) => {
  const { repository, marketing, sql } = await isolated(t);
  const saved = record({ checkoutId: "checkout-marketing-fence" });
  await repository.create(saved);
  await repository.complete({ checkoutId: saved.checkoutId, orderId: "square-fence", paymentId: "payment-fence" });
  await marketing.enqueue({ provider: "google", squareOrderId: "square-fence", checkoutId: saved.checkoutId, payload: { orderId: "square-fence" } });
  const [leased] = await marketing.claim(1);
  await sql`UPDATE aha_marketing_purchase_outbox SET attempt_count = ${leased.attempt_count + 1}, lease_expires_at = now() + interval '90 seconds' WHERE id = ${leased.id}`;
  assert.equal(await marketing.markSent({ id: leased.id, attemptCount: leased.attempt_count }), null);
  const [row] = await sql`SELECT state, attempt_count FROM aha_marketing_purchase_outbox WHERE id = ${leased.id}`;
  assert.equal(row.state, "sending");
  assert.equal(row.attempt_count, leased.attempt_count + 1);
});

test("Postgres permits one durable payment claim under concurrent checkout submits", async (t) => {
  const { repository } = await isolated(t); const saved = record(); await repository.create(saved);
  const rows = await Promise.all(Array.from({ length: 12 }, () => repository.claim({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash, clientIdempotencyKey: "client-claim-0000001" })));
  assert.equal(rows.filter(Boolean).length, 1);
  assert.equal((await repository.get(saved.checkoutId)).state, "processing");
});

test("recovery atomically closes an unclaimed quote so a late payment cannot claim it", async (t) => {
  const { repository } = await isolated(t); const saved = record({ checkoutId: "checkout-db-close" }); await repository.create(saved);
  const [closed, claim] = await Promise.all([
    repository.cancelUnclaimedRecovery({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash }),
    repository.claim({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash, clientIdempotencyKey: "client-claim-0000004" }),
  ]);
  assert.equal(Boolean(closed) === Boolean(claim), false);
  const row = await repository.get(saved.checkoutId);
  assert.equal(row.state === "failed" || row.state === "processing", true);
  if (row.state === "failed") assert.equal(row.last_error_code, "payment_not_started");
});

test("an expired unmarked processing lease closes before payment submission", async (t) => {
  const { database, repository } = await isolated(t); const saved = record({ checkoutId: "checkout-db-expired" }); await repository.create(saved);
  await repository.claim({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash, clientIdempotencyKey: "client-claim-0000005" });
  await database.query("UPDATE aha_checkout_sessions SET processing_lease_expires_at = now() - interval '1 second' WHERE checkout_id = $1", [saved.checkoutId]);
  const closed = await repository.closeExpiredUnpaid({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash });
  assert.equal(closed.state, "failed"); assert.equal(closed.last_error_code, "payment_not_started");
  assert.equal(await repository.markPaymentSubmissionStarted({ checkoutId: saved.checkoutId, orderId: "order-late" }), null);
});

test("an unknown unmarked checkout closes after persistence failed before payment submission", async (t) => {
  const { repository } = await isolated(t); const saved = record({ checkoutId: "checkout-db-unknown-unmarked" }); await repository.create(saved);
  await repository.claim({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash, clientIdempotencyKey: "client-claim-0000006" });
  await repository.unknown({ checkoutId: saved.checkoutId, code: "persistence_interrupted" });
  const closed = await repository.closeExpiredUnpaid({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash });
  assert.equal(closed.state, "failed"); assert.equal(closed.last_error_code, "payment_not_started");
});

test("known Square order is retained if payment outcome becomes unknown", async (t) => {
  const { repository } = await isolated(t); const saved = record(); await repository.create(saved);
  await repository.claim({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash, clientIdempotencyKey: "client-claim-0000002" });
  await repository.unknown({ checkoutId: saved.checkoutId, code: "payment_outcome_unknown", orderId: "square-order-known" });
  const row = await repository.get(saved.checkoutId);
  assert.equal(row.state, "unknown"); assert.equal(row.square_order_id, "square-order-known");
});

test("status can reconcile a processing checkout after quote expiry without source-token replay", async (t) => {
  const { database, repository } = await isolated(t); const token = "recover-after-expiry"; const saved = record({ checkoutId: "checkout-db-recover", token }); await repository.create(saved);
  await repository.claim({ checkoutId: saved.checkoutId, tokenHash: saved.tokenHash, clientIdempotencyKey: "client-claim-0000003" });
  await repository.saveOrder({ checkoutId: saved.checkoutId, orderId: "square-order-recover" });
  await database.query("UPDATE aha_checkout_sessions SET expires_at = now() - interval '1 second' WHERE checkout_id = $1", [saved.checkoutId]);
  const square = { getOrder: async () => ({ tenders: [{ payment_id: "payment-recover" }] }), getPayment: async () => ({ id: "payment-recover", status: "COMPLETED", order_id: "square-order-recover", location_id: "TEST_LOCATION", amount_money: { amount: 5200, currency: "USD" }, receipt_url: "https://squareup.com/receipt/recover" }) };
  const service = createCheckoutService({ repository, square, config: { locationId: "TEST_LOCATION" } });
  const outcome = await service.status({ checkoutId: saved.checkoutId, checkoutToken: token });
  assert.equal(outcome.state, "completed"); assert.equal(outcome.paymentId, "payment-recover"); assert.equal(outcome.receiptUrl, "https://squareup.com/receipt/recover");
});
