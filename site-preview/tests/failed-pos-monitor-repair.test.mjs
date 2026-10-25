import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createNetlifyRepository } from "../server/fulfillment/repository.mjs";
import { listOrders, orderFlags } from "../server/admin/orders.mjs";
import { orderProblems } from "../server/operations/report.mjs";

const NAME = "20261025065000_failed_pos_monitor_repair";
const migration = await readFile(new URL(`../netlify/database/migrations/${NAME}/migration.sql`, import.meta.url), "utf8");
const BASE = ["20261015045000_yikes_fulfillment", "20261015160000_custom_checkout", "20261015170000_order_notifications", "20261016110000_product_drafts", "20261016120000_admin"];
const ORDER = "local-failed-pos-order";
const PAYMENT = "local-failed-pos-payment";
const hash = (value) => createHash("sha256").update(value).digest("hex");
// Exercise the exact SQL with synthetic identifiers; production identifiers
// and private account evidence do not belong in the public repository.
const fixtureMigration = migration
  .replace(/(order_fingerprint CONSTANT text := ')[a-f0-9]{64}(';)/, (_, prefix, suffix) => prefix + hash(ORDER) + suffix)
  .replace(/(payment_fingerprint CONSTANT text := ')[a-f0-9]{64}(';)/, (_, prefix, suffix) => prefix + hash(PAYMENT) + suffix);

async function setup(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of BASE) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const db = { sql: async (strings, ...values) => (await pg.query(strings.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""), values)).rows };
  const repo = createNetlifyRepository(db);
  const seed = async (id = ORDER, payment = PAYMENT) => pg.query(`INSERT INTO aha_fulfillment_orders
    (square_order_id, square_payment_id, state, last_error_code, created_at, updated_at)
    VALUES ($1, $2, 'held', 'payment_terminal', '2020-01-01', '2020-01-01')`, [id, payment]);
  return { pg, db, repo, seed };
}

test("failed POS repair is identical at both migration paths and uses private target fingerprints", async () => {
  assert.equal(migration, await readFile(new URL(`../../netlify/database/migrations/${NAME}/migration.sql`, import.meta.url), "utf8"));
  assert.notEqual(fixtureMigration, migration);
  assert.ok(fixtureMigration.includes(hash(ORDER)) && fixtureMigration.includes(hash(PAYMENT)));
  assert.equal(/https?:\/\//.test(migration), false);
});

test("only the verified monitor row changes, alerts clear, audit is durable and replay cannot resubmit", async (t) => {
  const { pg, db, repo, seed } = await setup(t);
  await seed();
  await seed("local-unrelated-order", "local-unrelated-payment");
  const before = await repo.getOrder(ORDER);
  const neighbor = await repo.getOrder("local-unrelated-order");
  assert.equal(orderFlags(before).some((flag) => flag.code === "held"), true);
  await pg.exec(fixtureMigration);
  const after = await repo.getOrder(ORDER);
  assert.equal(after.state, "ignored");
  assert.equal(after.last_error_code, null);
  assert.equal(after.provider_status, "non_shipping_receipt");
  for (const key of Object.keys(before).filter((key) => !["state", "last_error_code", "provider_status", "updated_at"].includes(key))) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(await repo.getOrder("local-unrelated-order"), neighbor);
  assert.deepEqual(orderFlags(after), []);
  assert.equal((await listOrders(db)).some((row) => row.squareOrderId === ORDER), false);
  assert.equal((await orderProblems(db)).some((line) => line.includes(ORDER)), false);
  assert.equal((await repo.attentionRows()).some((row) => row.orderId === ORDER), false);
  assert.equal(await repo.claimForSubmission(ORDER), null);
  const audit = (await pg.query("SELECT action, target, detail_json FROM aha_admin_audit")).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "fulfillment.monitor_repaired");
  assert.equal(audit[0].target, ORDER);
  assert.equal(audit[0].detail_json.fromError, "payment_terminal");
  assert.equal(audit[0].detail_json.migration, NAME);
  assert.equal(audit[0].detail_json.providerWrites, false);
  assert.equal(audit[0].detail_json.notificationWrites, false);
  await pg.exec(fixtureMigration);
  assert.deepEqual(await repo.getOrder(ORDER), after);
  assert.deepEqual((await pg.query("SELECT action, target, detail_json FROM aha_admin_audit")).rows, audit);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_order_notifications")).rows[0].n, 0);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_checkout_sessions")).rows[0].n, 0);
});

test("changed target evidence fails closed without editing or auditing the row", async (t) => {
  const { pg, repo, seed } = await setup(t);
  const cases = {
    "wrong payment": "UPDATE aha_fulfillment_orders SET square_payment_id = 'different-payment'",
    "missing payment": "UPDATE aha_fulfillment_orders SET square_payment_id = NULL",
    "provider order": "UPDATE aha_fulfillment_orders SET apliiq_order_id = 'existing-provider-order'",
    "Square shipment": "UPDATE aha_fulfillment_orders SET square_fulfillment_uid = 'existing-fulfillment'",
    "validated payment": "UPDATE aha_fulfillment_orders SET payment_created_at = now()",
    "submission attempted": "UPDATE aha_fulfillment_orders SET attempt_count = 1",
    "claimed submission": "UPDATE aha_fulfillment_orders SET claimed_at = now()",
    "submitted items": "UPDATE aha_fulfillment_orders SET submitted_items = '[{\"sku\":\"LOCAL-SKU\"}]'",
    "provider payload": "UPDATE aha_fulfillment_orders SET apliiq_payload = '{\"id\":\"local\"}'",
    "payload fingerprint": "UPDATE aha_fulfillment_orders SET payload_sha256 = 'local-payload-hash'",
    "tracking": "UPDATE aha_fulfillment_orders SET tracking = '[{\"trackingNumber\":\"local\"}]'",
    "shipped quantity": "UPDATE aha_fulfillment_orders SET shipped_line_quantities = '{\"local\":1}'",
    "different state": "UPDATE aha_fulfillment_orders SET state = 'queued'",
    "different error": "UPDATE aha_fulfillment_orders SET last_error_code = 'payment_refunded'",
    "provider status": "UPDATE aha_fulfillment_orders SET provider_status = 'attention'",
    "unaudited ignored row": "UPDATE aha_fulfillment_orders SET state = 'ignored', last_error_code = NULL, provider_status = 'non_shipping_receipt'",
    "storefront checkout": `INSERT INTO aha_checkout_sessions
      (checkout_id, token_sha256, state, cart_json, shipping_address_json, order_payload_json, subtotal_cents, shipping_cents, tax_cents, total_cents, square_order_id, order_idempotency_key, expires_at)
      VALUES ('local-checkout', 'local-token', 'completed', '[]', '{}', '{}', 1, 0, 0, 1, '${ORDER}', 'local-key', now())`,
    "provider event": `INSERT INTO aha_fulfillment_events (provider_event_id, square_order_id) VALUES ('local-event', '${ORDER}')`,
    "pending Square event": `INSERT INTO aha_fulfillment_square_events (square_event_id, square_payment_id) VALUES ('local-event', '${PAYMENT}')`,
  };
  for (const [name, change] of Object.entries(cases)) {
    await t.test(name, async () => {
      await pg.exec("TRUNCATE aha_fulfillment_orders, aha_admin_audit, aha_checkout_sessions, aha_fulfillment_events, aha_fulfillment_square_events");
      await seed();
      await pg.exec(change);
      const before = await repo.getOrder(ORDER);
      await assert.rejects(pg.exec(fixtureMigration), /target is not eligible/);
      assert.deepEqual(await repo.getOrder(ORDER), before);
      assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_admin_audit")).rows[0].n, 0);
    });
  }
});

test("audit insertion failure rolls back the monitor update", async (t) => {
  const { pg, repo, seed } = await setup(t);
  await seed();
  const before = await repo.getOrder(ORDER);
  await pg.exec("ALTER TABLE aha_admin_audit ADD CONSTRAINT local_reject_audit CHECK (false)");
  await assert.rejects(pg.exec(fixtureMigration), /local_reject_audit/);
  assert.deepEqual(await repo.getOrder(ORDER), before);
});

test("fresh databases without the historical record are unchanged", async (t) => {
  const { pg, repo, seed } = await setup(t);
  await seed("local-unrelated-order", "local-unrelated-payment");
  const before = await repo.getOrder("local-unrelated-order");
  await pg.exec(fixtureMigration);
  assert.deepEqual(await repo.getOrder("local-unrelated-order"), before);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_admin_audit")).rows[0].n, 0);
});
