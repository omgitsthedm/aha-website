import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createCheckoutRepository } from "../server/checkout/repository.mjs";
import { createCheckoutService } from "../server/checkout/service.mjs";

const migration = new URL("../netlify/database/migrations/20261015160000_custom_checkout/migration.sql", import.meta.url);
const rootMigration = new URL("../../netlify/database/migrations/20261015160000_custom_checkout/migration.sql", import.meta.url);
const tokenHash = (value) => createHash("sha256").update(value).digest("hex");

async function isolated(t) {
  const database = new PGlite(); t.after(() => database.close());
  await database.exec(await readFile(migration, "utf8"));
  const sql = async (strings, ...parameters) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { database, repository: createCheckoutRepository({ sql }) };
}
function record({ checkoutId = "checkout-db-1", token = "test-token", expiresAt = "2030-01-01T00:00:00.000Z" } = {}) {
  return { checkoutId, tokenHash: tokenHash(token), currency: "USD", cart: [{ variationId: "R5UCZCGSJMR3Z4HJDVOD3ZIK", quantity: 1, unitAmount: 5200, totalAmount: 5200 }], address: { firstName: "A", lastName: "B", addressLine1: "1 Main", city: "New York", region: "NY", postalCode: "10001", country: "US", email: "a@example.com" }, orderPayload: { location_id: "FGKRPYEXNV482", line_items: [] }, subtotalCents: 5200, shippingCents: 0, taxCents: 0, totalCents: 5200, taxLabel: null, orderIdempotencyKey: `order-${checkoutId}`, expiresAt };
}

test("checkout migration remains identical at repository and Netlify discovery paths", async () => {
  assert.equal(await readFile(migration, "utf8"), await readFile(rootMigration, "utf8"));
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
  const square = { getOrder: async () => ({ tenders: [{ payment_id: "payment-recover" }] }), getPayment: async () => ({ id: "payment-recover", status: "COMPLETED", order_id: "square-order-recover", location_id: "FGKRPYEXNV482", amount_money: { amount: 5200, currency: "USD" }, receipt_url: "https://squareup.com/receipt/recover" }) };
  const service = createCheckoutService({ repository, square, config: { locationId: "FGKRPYEXNV482" } });
  const outcome = await service.status({ checkoutId: saved.checkoutId, checkoutToken: token });
  assert.equal(outcome.state, "completed"); assert.equal(outcome.paymentId, "payment-recover"); assert.equal(outcome.receiptUrl, "https://squareup.com/receipt/recover");
});
