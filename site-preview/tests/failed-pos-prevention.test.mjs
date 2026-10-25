import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createNetlifyRepository } from "../server/fulfillment/repository.mjs";
import { createFulfillmentService } from "../server/fulfillment/service.mjs";
import { listOrders } from "../server/admin/orders.mjs";
import { orderProblems } from "../server/operations/report.mjs";

const LOCATION = "local-pos-location";
const ORDER = "local-pos-order";
const PAYMENT = "local-pos-payment";
const BASE = ["20261015045000_yikes_fulfillment", "20261015160000_custom_checkout", "20261015170000_order_notifications", "20261016110000_product_drafts", "20261016120000_admin"];
const ignored = { outcome: "ignored", code: "non_shipping_receipt" };

function receipt() {
  return {
    payment: { id: PAYMENT, order_id: ORDER, location_id: LOCATION, status: "FAILED",
      application_details: { square_product: "RETAIL" }, source_type: "CARD",
      card_details: { entry_method: "CONTACTLESS" }, amount_money: { amount: 100, currency: "USD" } },
    order: { id: ORDER, location_id: LOCATION, state: "CANCELED", total_money: { amount: 100, currency: "USD" },
      line_items: [{ uid: "local-custom-line", quantity: "1", base_price_money: { amount: 100, currency: "USD" } }] },
  };
}

async function setup(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of BASE) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const db = { sql: async (strings, ...values) => (await pg.query(strings.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""), values)).rows };
  const repo = createNetlifyRepository(db);
  const calls = [];
  // Count forbidden operations as well as throwing: the service catches some
  // gateway errors, so a thrown error alone would not prove absence of a call.
  const forbidden = async () => { calls.push("provider or notification"); throw new Error("external write forbidden"); };
  const serviceFor = ({ payment, order }, repository = repo) => createFulfillmentService({ repository,
    square: { getPayment: async () => structuredClone(payment), getOrder: async () => structuredClone(order), updateShipment: forbidden },
    apliiq: { createOrder: forbidden, listOrders: forbidden, getOrder: forbidden },
    notifications: { enqueueConfirmation: forbidden, enqueueShipment: forbidden },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-01T00:00:00Z" },
  });
  const reset = () => pg.exec("TRUNCATE aha_fulfillment_orders, aha_fulfillment_square_events, aha_fulfillment_events, aha_checkout_sessions, aha_admin_audit");
  const seedIgnored = async () => {
    await pg.query("INSERT INTO aha_fulfillment_orders (square_order_id, square_payment_id, state, provider_status) VALUES ($1, $2, 'ignored', 'non_shipping_receipt')", [ORDER, PAYMENT]);
    await pg.query("INSERT INTO aha_admin_audit (action, target, detail_json) VALUES ('fulfillment.monitor_repaired', $1, $2)", [ORDER, JSON.stringify({ reason: "verified_failed_non_shipping_receipt", fromError: "payment_terminal", toState: "ignored" })]);
  };
  t.after(() => assert.deepEqual(calls, []));
  return { pg, db, repo, calls, serviceFor, reset, seedIgnored };
}

test("verified failed POS events finish without a monitor row, alert, provider call or notification", async (t) => {
  const { repo, db, pg, serviceFor } = await setup(t);
  for (const product of ["RETAIL", "SQUARE_POS"]) for (const entry of ["CONTACTLESS", "EMV", "SWIPED"]) for (const empty of [false, true]) {
    const pair = receipt();
    pair.payment.application_details.square_product = product;
    pair.payment.card_details.entry_method = entry;
    if (empty) pair.order.fulfillments = [];
    const service = serviceFor(pair);
    const eventId = `${product}-${entry}-${empty}`;
    await repo.ingestSquareEvent({ eventId, paymentId: PAYMENT });
    assert.deepEqual(await service.processSquareEvent(eventId), ignored);
    assert.deepEqual(await service.processSquareEvent(eventId), { outcome: "duplicate" });
    const event = (await pg.query("SELECT processed_at, last_error_code FROM aha_fulfillment_square_events WHERE square_event_id = $1", [eventId])).rows[0];
    assert.ok(event.processed_at);
    assert.equal(event.last_error_code, null);
  }
  assert.equal(await repo.getOrder(ORDER), null);
  assert.deepEqual(await listOrders(db), []);
  assert.deepEqual(await orderProblems(db), []);
  assert.deepEqual(await repo.attentionRows(), []);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_order_notifications")).rows[0].n, 0);
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_admin_audit")).rows[0].n, 0);
});

test("a replay preserves the already audited ignored row and original failure evidence", async (t) => {
  const { pg, repo, serviceFor, seedIgnored } = await setup(t);
  await seedIgnored();
  const before = await repo.getOrder(ORDER);
  const audit = (await pg.query("SELECT * FROM aha_admin_audit")).rows;
  for (const eventId of ["failed-payment-created", "failed-payment-updated"]) {
    await repo.ingestSquareEvent({ eventId, paymentId: PAYMENT });
    assert.deepEqual(await serviceFor(receipt()).processSquareEvent(eventId), ignored);
  }
  assert.deepEqual(await repo.getOrder(ORDER), before);
  assert.deepEqual((await pg.query("SELECT * FROM aha_admin_audit")).rows, audit);
});

test("storefront and ambiguous terminal payments still produce a payment-terminal hold", async (t) => {
  const { repo, serviceFor, reset } = await setup(t);
  const cases = {
    "website application": ({ payment }) => { payment.application_details.square_product = "ECOMMERCE_API"; },
    "online store": ({ payment }) => { payment.application_details.square_product = "ONLINE_STORE"; },
    "unknown product": ({ payment }) => { payment.application_details.square_product = "OTHER"; },
    "missing source": ({ payment }) => { delete payment.application_details; },
    "payment reference": ({ payment }) => { payment.reference_id = "AHA-local-checkout"; },
    "order reference": ({ order }) => { order.reference_id = "AHA-local-checkout"; },
    "malformed reference": ({ order }) => { order.reference_id = false; },
    "known catalog item": ({ order }) => { order.line_items[0].catalog_object_id = "R5UCZCGSJMR3Z4HJDVOD3ZIK"; },
    "unknown catalog item": ({ order }) => { order.line_items[0].catalog_object_id = "unmapped-variation"; },
    "shipment": ({ order }) => { order.fulfillments = [{ type: "SHIPMENT", state: "CANCELED" }]; },
    "pickup": ({ order }) => { order.fulfillments = [{ type: "PICKUP" }]; },
    "null fulfillments": ({ order }) => { order.fulfillments = null; },
    "malformed fulfillments": ({ order }) => { order.fulfillments = {}; },
    "open order": ({ order }) => { order.state = "OPEN"; },
    "completed order": ({ order }) => { order.state = "COMPLETED"; },
    "wrong order identity": ({ order }) => { order.id = "different-order"; },
    "wrong payment identity": ({ payment }) => { payment.id = "different-payment"; },
    "foreign payment location": ({ payment }) => { payment.location_id = "another-location"; },
    "foreign order location": ({ order }) => { order.location_id = "another-location"; },
    "missing location": ({ payment }) => { delete payment.location_id; },
    "card on file": ({ payment }) => { payment.card_details.entry_method = "ON_FILE"; },
    "keyed card": ({ payment }) => { payment.card_details.entry_method = "KEYED"; },
    "missing card evidence": ({ payment }) => { delete payment.card_details; },
    "non-card source": ({ payment }) => { payment.source_type = "EXTERNAL"; },
    "mismatched amount": ({ order }) => { order.total_money.amount = 200; },
    "foreign currency": ({ payment }) => { payment.amount_money.currency = "CAD"; },
    "missing amount": ({ payment }) => { delete payment.amount_money; },
    "invalid amount": ({ payment }) => { payment.amount_money.amount = "100"; },
    "zero amount": ({ payment, order }) => { payment.amount_money.amount = order.total_money.amount = 0; },
    "missing lines": ({ order }) => { delete order.line_items; },
    "empty lines": ({ order }) => { order.line_items = []; },
    "malformed line": ({ order }) => { order.line_items = [null]; },
    "missing line identity": ({ order }) => { delete order.line_items[0].uid; },
    "invalid quantity": ({ order }) => { order.line_items[0].quantity = "0"; },
    "malformed quantity": ({ order }) => { order.line_items[0].quantity = true; },
    "canceled payment": ({ payment }) => { payment.status = "CANCELED"; },
    "voided payment": ({ payment }) => { payment.status = "VOIDED"; },
  };
  for (const [name, change] of Object.entries(cases)) await t.test(name, async () => {
    await reset();
    const pair = receipt(); change(pair);
    const result = await serviceFor(pair).processSquarePayment(PAYMENT);
    assert.deepEqual(result, { outcome: "held", code: "payment_terminal" });
    assert.equal((await repo.getOrder(pair.order.id)).state, "held");
  });
});

test("durable checkout links keep failures held even when Square references and catalog data are missing", async (t) => {
  const { pg, repo, serviceFor, reset } = await setup(t);
  for (const state of ["quoted", "processing", "completed", "failed", "unknown"]) for (const link of ["order", "payment"]) {
    await reset();
    await pg.query(`INSERT INTO aha_checkout_sessions
      (checkout_id, token_sha256, state, cart_json, shipping_address_json, order_payload_json,
       subtotal_cents, shipping_cents, tax_cents, total_cents, square_order_id, square_payment_id, order_idempotency_key, expires_at)
      VALUES ('local-checkout', 'local-token', $1, '[]', '{}', '{}', 100, 0, 0, 100, $2, $3, 'local-key', now())`,
    [state, link === "order" ? ORDER : "other-order", link === "payment" ? PAYMENT : null]);
    assert.deepEqual(await serviceFor(receipt()).processSquarePayment(PAYMENT), { outcome: "held", code: "payment_terminal" }, `${state}/${link}`);
    assert.equal((await repo.getOrder(ORDER)).state, "held");
  }
});

test("provider evidence and active monitor rows can never qualify for the failed-POS exception", async (t) => {
  const { pg, repo, reset, seedIgnored } = await setup(t);
  const cases = {
    "held": "UPDATE aha_fulfillment_orders SET state = 'held', last_error_code = 'payment_terminal'",
    "queued": "UPDATE aha_fulfillment_orders SET state = 'queued'",
    "submitting": "UPDATE aha_fulfillment_orders SET state = 'submitting'",
    "uncertain": "UPDATE aha_fulfillment_orders SET state = 'uncertain'",
    "submitted": "UPDATE aha_fulfillment_orders SET state = 'submitted_processed'",
    "attention": "UPDATE aha_fulfillment_orders SET state = 'attention'",
    "shipped": "UPDATE aha_fulfillment_orders SET state = 'shipped'",
    "active error": "UPDATE aha_fulfillment_orders SET last_error_code = 'payment_terminal'",
    "other provider status": "UPDATE aha_fulfillment_orders SET provider_status = 'attention'",
    "unknown provider status": "UPDATE aha_fulfillment_orders SET provider_status = NULL",
    "different payment": "UPDATE aha_fulfillment_orders SET square_payment_id = 'other-payment'",
    "missing payment": "UPDATE aha_fulfillment_orders SET square_payment_id = NULL",
    "different order": "UPDATE aha_fulfillment_orders SET square_order_id = 'other-order'",
    "provider order": "UPDATE aha_fulfillment_orders SET apliiq_order_id = 'local-provider'",
    "fulfillment": "UPDATE aha_fulfillment_orders SET square_fulfillment_uid = 'local-shipment'",
    "validated payment": "UPDATE aha_fulfillment_orders SET payment_created_at = now()",
    "customer email": "UPDATE aha_fulfillment_orders SET customer_email = 'local@example.com'",
    "attempt": "UPDATE aha_fulfillment_orders SET attempt_count = 1",
    "claim": "UPDATE aha_fulfillment_orders SET claimed_at = now()",
    "items": "UPDATE aha_fulfillment_orders SET submitted_items = '[{}]'",
    "payload": "UPDATE aha_fulfillment_orders SET apliiq_payload = '{\"id\":\"local\"}'",
    "payload hash": "UPDATE aha_fulfillment_orders SET payload_sha256 = 'local-hash'",
    "tracking": "UPDATE aha_fulfillment_orders SET tracking = '[{}]'",
    "shipped quantities": "UPDATE aha_fulfillment_orders SET shipped_line_quantities = '{\"local\":1}'",
    "no audit": "DELETE FROM aha_admin_audit",
    "different audit reason": "UPDATE aha_admin_audit SET detail_json = '{}'",
    "provider callback": `INSERT INTO aha_fulfillment_events (provider_event_id, square_order_id) VALUES ('local-provider-event', '${ORDER}')`,
  };
  for (const [name, change] of Object.entries(cases)) await t.test(name, async () => {
    await reset(); await seedIgnored(); await pg.exec(change);
    const before = (await pg.query("SELECT * FROM aha_fulfillment_orders")).rows;
    assert.equal(await repo.canIgnoreFailedPosReceipt({ squareOrderId: ORDER, squarePaymentId: PAYMENT }), false);
    assert.deepEqual((await pg.query("SELECT * FROM aha_fulfillment_orders")).rows, before);
  });
});

test("a failed eligibility read leaves the signed event retryable without dismissing it", async (t) => {
  const { pg, repo, serviceFor } = await setup(t);
  await repo.ingestSquareEvent({ eventId: "local-read-failure", paymentId: PAYMENT });
  const service = serviceFor(receipt(), { ...repo, canIgnoreFailedPosReceipt: async () => { throw new Error("database unavailable"); } });
  await assert.rejects(service.processSquareEvent("local-read-failure"), /database unavailable/);
  const event = (await pg.query("SELECT processed_at, last_error_code FROM aha_fulfillment_square_events")).rows[0];
  assert.equal(event.processed_at, null);
  assert.equal(event.last_error_code, "square_event_processing_failed");
  assert.equal(await repo.getOrder(ORDER), null);
});

test("a genuine failed storefront payment remains visible in admin, daily and health checks", async (t) => {
  const { db, repo, serviceFor } = await setup(t);
  const pair = receipt();
  pair.payment.application_details.square_product = "ECOMMERCE_API";
  pair.payment.card_details.entry_method = "KEYED";
  pair.payment.reference_id = pair.order.reference_id = "AHA-local-checkout";
  pair.order.line_items[0].catalog_object_id = "R5UCZCGSJMR3Z4HJDVOD3ZIK";
  pair.order.fulfillments = [{ uid: "local-shipment", type: "SHIPMENT", state: "PROPOSED" }];
  await repo.ingestSquareEvent({ eventId: "local-storefront-failure", paymentId: PAYMENT });
  assert.deepEqual(await serviceFor(pair).processSquareEvent("local-storefront-failure"), { outcome: "held", code: "payment_terminal" });
  assert.ok((await listOrders(db)).some((row) => row.squareOrderId === ORDER));
  assert.ok((await orderProblems(db)).some((line) => line.includes(ORDER)));
  assert.ok((await repo.attentionRows()).some((row) => row.orderId === ORDER));
});

test("a scheduled POS retry finishes while a genuine storefront failure remains held", async (t) => {
  const { pg, repo, serviceFor } = await setup(t);
  const pair = receipt();
  await repo.ingestSquareEvent({ eventId: "local-scheduled-pos", paymentId: PAYMENT });
  assert.deepEqual(await serviceFor(pair).runScheduled(), { inbound: 1, queued: 0, reconciled: 0 });
  assert.equal(await repo.getOrder(ORDER), null);
  pair.payment.reference_id = "AHA-local-checkout";
  await repo.ingestSquareEvent({ eventId: "local-scheduled-storefront", paymentId: PAYMENT });
  await serviceFor(pair).runScheduled();
  assert.equal((await repo.getOrder(ORDER)).state, "held");
  assert.equal((await repo.getOrder(ORDER)).last_error_code, "payment_terminal");
  assert.equal((await pg.query("SELECT count(*)::int AS n FROM aha_fulfillment_square_events WHERE processed_at IS NULL")).rows[0].n, 0);
});
