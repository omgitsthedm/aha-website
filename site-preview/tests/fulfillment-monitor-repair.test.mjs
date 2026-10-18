import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createNetlifyRepository } from "../server/fulfillment/repository.mjs";
import { listOrders, orderFlags, overview } from "../server/admin/orders.mjs";
import { orderProblems } from "../server/operations/report.mjs";

const NAME = "20261018075000_fulfillment_monitor_repair";
const migration = await readFile(new URL(`../netlify/database/migrations/${NAME}/migration.sql`, import.meta.url), "utf8");
const BASE = ["20261015045000_yikes_fulfillment", "20261015160000_custom_checkout", "20261015170000_order_notifications", "20261016110000_product_drafts", "20261016120000_admin"];

test("monitor repair is byte-identical at both migration discovery paths", async () => {
  assert.equal(migration, await readFile(new URL(`../../netlify/database/migrations/${NAME}/migration.sql`, import.meta.url), "utf8"));
});

test("repair preserves provider identity, attempts and payloads, audits once, and cannot queue a resubmission", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of BASE) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const db = { sql: async (strings, ...values) => (await pg.query(strings.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""), values)).rows };
  const repo = createNetlifyRepository(db);
  const seed = async (id, overrides = {}) => {
    const row = { state: "held", error: "unsupported_fulfillment_shape", provider: null, status: null, fulfillment: null,
      payload: {}, items: [], attempts: 0, tracking: [], updated: "2026-10-17T11:00:00Z", ...overrides };
    await pg.query(`INSERT INTO aha_fulfillment_orders
      (square_order_id, square_payment_id, state, last_error_code, apliiq_order_id, provider_status, square_fulfillment_uid,
       apliiq_payload, submitted_items, attempt_count, tracking, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [id, `payment-${id}`, row.state, row.error, row.provider, row.status, row.fulfillment,
      JSON.stringify(row.payload), JSON.stringify(row.items), row.attempts, JSON.stringify(row.tracking), row.updated]);
  };
  await seed("local-receipt");
  await seed("local-shipment", { state: "attention", error: "provider_join_mismatch", provider: "local-apliiq", status: "id_mismatch",
    fulfillment: "local-fulfillment", payload: { id: "local-shipment", line_items: [{ sku: "LOCAL-SKU", quantity: 1 }] },
    items: [{ sku: "LOCAL-SKU", quantity: 1 }], attempts: 1 });
  const before = await repo.getOrder("local-shipment");
  const protectedRows = {
    "recent": { updated: "2026-10-19T00:00:00Z" },
    "has-shipment": { fulfillment: "existing-fulfillment" },
    "attempted": { attempts: 1 },
    "has-provider": { provider: "other-apliiq" },
    "has-items": { items: [{ sku: "LOCAL-SKU", quantity: 1 }] },
    "has-payload": { payload: { id: "has-payload" } },
    "has-tracking": { tracking: [{ trackingNumber: "LOCAL-TRACKING" }] },
    "refunded": { error: "payment_refunded" },
    "has-checkout": {},
  };
  for (const [id, values] of Object.entries(protectedRows)) await seed(id, values);
  await pg.exec(`INSERT INTO aha_checkout_sessions
    (checkout_id, token_sha256, state, cart_json, shipping_address_json, order_payload_json, subtotal_cents, shipping_cents, tax_cents, total_cents, square_order_id, order_idempotency_key, expires_at)
    VALUES ('local-checkout', 'local-token', 'completed', '[]', '{}', '{}', 1, 0, 0, 1, 'has-checkout', 'local-key', now())`);
  await pg.exec(migration);
  const receipt = await repo.getOrder("local-receipt");
  assert.equal(receipt.state, "ignored");
  assert.equal(receipt.last_error_code, null);
  assert.equal(receipt.attempt_count, 0);
  assert.equal(receipt.apliiq_order_id, null);
  assert.deepEqual(orderFlags({ ...receipt, created_at: "2020-01-01T00:00:00Z" }), []);
  const after = await repo.getOrder("local-shipment");
  assert.equal(after.state, "submitted_reconciled");
  assert.equal(after.provider_status, "reconciliation_pending");
  for (const field of ["apliiq_order_id", "square_payment_id", "square_fulfillment_uid", "apliiq_payload", "submitted_items", "attempt_count", "tracking"]) assert.deepEqual(after[field], before[field]);
  assert.equal(await repo.claimForSubmission("local-shipment"), null);
  assert.equal(await repo.claimForSubmission("local-receipt"), null);
  for (const id of Object.keys(protectedRows)) assert.equal((await repo.getOrder(id)).state, "held", id);
  await pg.exec(migration);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_admin_audit")).rows[0].n, 2);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_order_notifications")).rows[0].n, 0);
  assert.equal((await listOrders(db)).some((row) => row.squareOrderId === "local-receipt"), false);
  assert.equal((await orderProblems(db, Date.parse("2027-01-01"))).some((line) => line.includes("local-receipt")), false);
  assert.equal((await overview(db)).ordersToday, Object.keys(protectedRows).length + 1);
});
