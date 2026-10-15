import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { sha256, verifySquareSignature } from "../server/fulfillment/crypto.mjs";
import { AHA_PRIVATE_LABEL } from "../server/fulfillment/catalog.mjs";
import { createFulfillmentService, FulfillmentHold, validatePaidSquareOrder } from "../server/fulfillment/service.mjs";
import { createSquareGateway } from "../server/fulfillment/square.mjs";
import squareWebhook from "../netlify/functions/square-webhook.mjs";
import apliiqWebhook from "../netlify/functions/apliiq-fulfillment-webhook.mjs";
import fulfillmentHealth from "../netlify/functions/fulfillment-health.mjs";

const LOCATION = "test-aha-location";
const CREW_M = "R5UCZCGSJMR3Z4HJDVOD3ZIK";
const HOODIE_L = "4HDYVGQA3ZOGIPYFUCTPKPIV";

function paidOrder(overrides = {}) {
  const order = {
    id: "square-order-1", location_id: LOCATION, state: "OPEN", version: 3, reference_id: "AHA-1001",
    total_money: { amount: 5200, currency: "USD" },
    line_items: [{ uid: "line-1", catalog_object_id: CREW_M, quantity: "1", base_price_money: { amount: 5200, currency: "USD" } }],
    fulfillments: [{ uid: "fulfillment-1", type: "SHIPMENT", state: "PROPOSED", shipment_details: { recipient: { display_name: "Ada Lovelace", address: { address_line_1: "1 Main St", locality: "New York", administrative_district_level_1: "NY", postal_code: "10001", country: "US" } } } }],
  };
  const payment = { id: "payment-1", order_id: order.id, location_id: LOCATION, status: "COMPLETED", created_at: "2026-10-15T05:00:00.000Z", amount_money: { amount: 5200, currency: "USD" } };
  return { payment: { ...payment, ...(overrides.payment ?? {}) }, order: { ...order, ...(overrides.order ?? {}) } };
}

function memoryRepository() {
  const rows = new Map();
  const squareEvents = new Map();
  return {
    rows, squareEvents,
    async upsertHold({ squareOrderId, squarePaymentId, state, lastErrorCode }) {
      const row = rows.get(squareOrderId) ?? { square_order_id: squareOrderId };
      Object.assign(row, { square_payment_id: squarePaymentId, state, last_error_code: lastErrorCode }); rows.set(squareOrderId, row); return row;
    },
    async insertValidated(record) {
      const existing = rows.get(record.squareOrderId);
      if (existing) return existing;
      const row = { square_order_id: record.squareOrderId, square_payment_id: record.squarePaymentId, square_fulfillment_uid: record.squareFulfillmentUid, customer_email: record.customerEmail ?? null, state: record.state, submitted_items: record.submittedItems, apliiq_payload: record.apliiqPayload, payload_sha256: record.payloadSha256 };
      rows.set(record.squareOrderId, row); return row;
    },
    async claimForSubmission(id) { const row = rows.get(id); if (!row || row.state !== "queued") return null; row.state = "submitting"; return row; },
    async releaseSubmissionClaim(id) { const row = rows.get(id); if (!row || row.state !== "submitting") return null; row.state = "queued"; return row; },
    async markSubmission({ squareOrderId, state, apliiqOrderId, providerStatus }) { const row = rows.get(squareOrderId); Object.assign(row, { state, apliiq_order_id: apliiqOrderId, provider_status: providerStatus }); return row; },
    async markUncertain({ squareOrderId, code }) { const row = rows.get(squareOrderId); Object.assign(row, { state: "uncertain", last_error_code: code }); return row; },
    async getOrder(id) { return rows.get(id) ?? null; },
    async listQueued() { return [...rows.values()].filter((row) => row.state === "queued"); },
    async listUncertain() { return [...rows.values()].filter((row) => ["submitting", "uncertain", "submitted_accepted"].includes(row.state)); },
    async ingestSquareEvent({ eventId, paymentId, eventCreatedAt = null }) { const row = squareEvents.get(eventId) ?? { square_event_id: eventId, square_payment_id: paymentId, event_created_at: eventCreatedAt, processed_at: null }; squareEvents.set(eventId, row); return row; },
    async claimSquareEvent(eventId) { const row = squareEvents.get(eventId); if (!row || row.processed_at) return null; row.lease_expires_at = "leased"; return row; },
    async listPendingSquareEvents() { return [...squareEvents.values()].filter((row) => !row.processed_at); },
    async markSquareEventProcessed(eventId) { squareEvents.get(eventId).processed_at = "done"; },
    async noteSquareEventError(eventId) { const row = squareEvents.get(eventId); if (row) row.lease_expires_at = null; },
    async touchReconciliationAttempt() {},
    async setProviderState({ squareOrderId, providerStatus, state }) { const row = rows.get(squareOrderId); Object.assign(row, { provider_status: providerStatus, state }); return row; },
    async recordShipment({ squareOrderId, quantities, tracking, complete }) { const row = rows.get(squareOrderId); Object.assign(row, { shipped_line_quantities: quantities, tracking: [tracking], state: complete ? "ready_to_ship" : "shipped_partial" }); return row; },
    async markShipped({ squareOrderId }) { const row = rows.get(squareOrderId); row.state = "shipped"; return row; },
  };
}

test("Square signature uses the canonical public URL and raw body", () => {
  const key = "test-key";
  const body = '{"event_id":"event-1"}';
  const signature = createHmac("sha256", key).update(`https://afterhoursagenda.com/api/webhooks/square${body}`).digest("base64");
  assert.equal(verifySquareSignature({ canonicalUrl: "https://afterhoursagenda.com/api/webhooks/square", rawBody: body, signature, signatureKey: key }), true);
  assert.equal(verifySquareSignature({ canonicalUrl: "https://preview.invalid/api/webhooks/square", rawBody: body, signature, signatureKey: key }), false);
});

test("fulfillment endpoints reject preview and untrusted-site requests before reading credentials", async () => {
  const previewContext = { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "deploy-preview" } };
  const foreignContext = { site: { id: "another-site" }, deploy: { context: "production" } };
  assert.equal((await squareWebhook(new Request("https://afterhoursagenda.com/api/webhooks/square", { method: "POST", body: "{}" }), previewContext)).status, 404);
  assert.equal((await apliiqWebhook(new Request("https://afterhoursagenda.com/api/webhooks/apliiq/fulfillment", { method: "POST", body: "{}" }), foreignContext)).status, 404);
  assert.equal((await fulfillmentHealth(new Request("https://afterhoursagenda.com/api/fulfillment/health"), previewContext)).status, 404);
});

test("only the exact active Square variation maps to the exact decorated Apliiq SKU", () => {
  const { payment, order } = paidOrder();
  const validated = validatePaidSquareOrder({ payment, order, locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" });
  assert.deepEqual(validated.items.map(({ variationId, sku, size }) => ({ variationId, sku, size })), [{ variationId: CREW_M, sku: "APQ-6208401S7A1", size: "M" }]);
  assert.equal(validated.apliiqPayload.line_items[0].price, "52.00");
  assert.deepEqual(validated.apliiqPayload.shipping_address, { first_name: "Ada", last_name: "Lovelace", address1: "1 Main St", city: "New York", zip: "10001", province: "NY", province_code: "NY", country: "United States", country_code: "US" });
  assert.throws(() => validatePaidSquareOrder({ payment, order: { ...order, line_items: [{ ...order.line_items[0], catalog_object_id: "untrusted" }] }, locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" }), (error) => error instanceof FulfillmentHold && error.code === "unknown_variation");
});

for (const scenario of [
  { label: "one of each", crewQuantity: 1, hoodieQuantity: 1, totalCents: 11567, taxCents: 867 },
  { label: "differing quantities", crewQuantity: 2, hoodieQuantity: 3, totalCents: 29079, taxCents: 2179 },
]) test(`mixed U.S. cart (${scenario.label}) keeps approved production SKUs and the configured private-label ID`, () => {
  // The tax amounts are illustrative Square fixtures. This test verifies the
  // post-payment fulfillment contract, not a tax-rate calculation.
  const { payment, order } = paidOrder({
    payment: { amount_money: { amount: scenario.totalCents, currency: "USD" } },
    order: {
      total_money: { amount: scenario.totalCents, currency: "USD" },
      total_tax_money: { amount: scenario.taxCents, currency: "USD" },
      // U.S. shipping is free, so the Square order has no freight service charge.
      service_charges: [],
      line_items: [
        { uid: "crew-m", catalog_object_id: CREW_M, quantity: String(scenario.crewQuantity), base_price_money: { amount: 5200, currency: "USD" } },
        { uid: "hoodie-l", catalog_object_id: HOODIE_L, quantity: String(scenario.hoodieQuantity), base_price_money: { amount: 5500, currency: "USD" } },
      ],
      fulfillments: [{
        uid: "fulfillment-mixed", type: "SHIPMENT", state: "PROPOSED",
        shipment_details: { recipient: { display_name: "Ada Lovelace", address: {
          address_line_1: "1 Main St", locality: "Peoria", administrative_district_level_1: "AZ", postal_code: "85381", country: "US",
        } } },
      }],
    },
  });

  const validated = validatePaidSquareOrder({ payment, order, locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" });

  // The label is configured on the approved Apliiq product, while the order
  // carries its decorated production SKU. Keep both facts pinned together.
  assert.equal(AHA_PRIVATE_LABEL, "SB-3-161622");
  assert.deepEqual(validated.apliiqPayload.line_items, [
    { id: "square-order-1:crew-m", title: "Yikes Crewneck — M", quantity: scenario.crewQuantity, price: "52.00", sku: "APQ-6208401S7A1" },
    { id: "square-order-1:hoodie-l", title: "Yikes Cropped Hoodie — L", quantity: scenario.hoodieQuantity, price: "55.00", sku: "APQ-6208412S8A1" },
  ]);
  assert.deepEqual(validated.shippingAddress, {
    firstName: "Ada", lastName: "Lovelace", address1: "1 Main St", city: "Peoria", zip: "85381", province: "AZ", provinceCode: "AZ", country: "United States", countryCode: "US",
  });
});

test("international recipient regions stay intact while only US needs a two-letter province code", () => {
  const { payment, order } = paidOrder();
  const international = structuredClone(order);
  international.fulfillments[0].shipment_details.recipient.address = { address_line_1: "8 Rue de Rivoli", locality: "Paris", administrative_district_level_1: "Île-de-France", postal_code: "75001", country: "FR" };
  const validated = validatePaidSquareOrder({ payment, order: international, locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" });
  assert.equal(validated.apliiqPayload.shipping_address.province, "Île-de-France");
  assert.equal("province_code" in validated.apliiqPayload.shipping_address, false);
});

test("Square shipment update completes the fulfillment and supplies shipped-at tracking", async () => {
  let update;
  const square = createSquareGateway({
    accessToken: "token",
    fetchImpl: async (_url, init) => { update = JSON.parse(init.body); return new Response(JSON.stringify({ order: {} }), { status: 200 }); },
  });
  await square.updateShipment({ order: { id: "order-1", location_id: LOCATION, version: 4 }, fulfillmentUid: "fulfillment-1", tracking: { carrier: "UPS", trackingNumber: "1Z9", trackingUrl: "https://example.test/1Z9", shippedAt: "2026-10-15T06:00:00.000Z" } });
  const fulfillment = update.order.fulfillments[0];
  assert.equal(fulfillment.state, "COMPLETED");
  assert.equal(fulfillment.shipment_details.tracking_number, "1Z9");
  assert.match(fulfillment.shipment_details.shipped_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("an Apliiq timeout becomes uncertain and scheduler reconciles without a second POST", async () => {
  const repo = memoryRepository();
  let posts = 0;
  const { payment, order } = paidOrder();
  const service = createFulfillmentService({
    repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order },
    apliiq: { createOrder: async () => { posts += 1; throw new Error("timeout"); }, listOrders: async () => [], getOrder: async () => [] },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquarePayment(payment.id)).outcome, "uncertain");
  assert.equal(posts, 1);
  await service.runScheduled();
  assert.equal(posts, 1);
  assert.equal(repo.rows.get(order.id).state, "uncertain");
});

test("Apliiq 202 is accepted but never mistaken for processed or posted twice", async () => {
  const repo = memoryRepository();
  let posts = 0;
  const { payment, order } = paidOrder();
  const service = createFulfillmentService({
    repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order },
    apliiq: { createOrder: async () => { posts += 1; return { status: 202, data: { id: "apliiq-accepted" } }; }, listOrders: async () => [], getOrder: async () => [] },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquarePayment(payment.id)).outcome, "submitted_accepted");
  assert.equal(repo.rows.get(order.id).state, "submitted_accepted");
  assert.equal((await service.processSquarePayment(payment.id)).outcome, "already_known");
  assert.equal(posts, 1);
});

test("pre-completion payment events are ignored without poisoning the completed event", async () => {
  const repo = memoryRepository();
  const { payment, order } = paidOrder({ payment: { status: "APPROVED" } });
  const service = createFulfillmentService({
    repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order },
    apliiq: { createOrder: async () => ({ status: 200, data: { id: "never" } }), listOrders: async () => [], getOrder: async () => [] },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.deepEqual(await service.processSquarePayment(payment.id), { outcome: "pending", code: "payment_not_completed", retryable: true });
  assert.equal(repo.rows.size, 0);
});

test("a refund update after provider submission becomes attention and cannot be shipped", async () => {
  const repo = memoryRepository();
  const { payment, order } = paidOrder({ payment: { refunded_money: { amount: 5200, currency: "USD" } } });
  repo.rows.set(order.id, { square_order_id: order.id, state: "submitted_processed", submitted_items: [], apliiq_payload: {} });
  const service = createFulfillmentService({
    repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order },
    apliiq: { createOrder: async () => { throw new Error("must not submit"); }, listOrders: async () => [], getOrder: async () => [] },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquarePayment(payment.id)).outcome, "attention");
  assert.equal(repo.rows.get(order.id).state, "attention");
});

test("a signed inbound payment survives into the durable event processor", async () => {
  const repo = memoryRepository();
  const { payment, order } = paidOrder();
  await repo.ingestSquareEvent({ eventId: "square-event-1", paymentId: payment.id });
  const service = createFulfillmentService({
    repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order },
    apliiq: { createOrder: async () => ({ status: 200, data: { id: "apliiq-1" } }), listOrders: async () => [], getOrder: async () => [] },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquareEvent("square-event-1")).outcome, "submitted_processed");
  assert.equal((await service.processSquareEvent("square-event-1")).outcome, "duplicate");
});

test("an incomplete payment event stays pending so scheduler can recover a missed update", async () => {
  const repo = memoryRepository();
  const { payment, order } = paidOrder({ payment: { status: "APPROVED" } });
  await repo.ingestSquareEvent({ eventId: "square-event-pending", paymentId: payment.id });
  const service = createFulfillmentService({
    repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order },
    apliiq: { createOrder: async () => { throw new Error("must not submit"); }, listOrders: async () => [], getOrder: async () => [] },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquareEvent("square-event-pending")).outcome, "pending");
  assert.equal(repo.rows.size, 0);
  assert.equal(repo.squareEvents.get("square-event-pending").processed_at, null);
});

test("a partial provider shipment stays partial and does not update Square", async () => {
  const repo = memoryRepository();
  const { payment, order } = paidOrder();
  const validated = validatePaidSquareOrder({ payment, order, locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" });
  const row = await repo.insertValidated({ ...validated, state: "submitted_processed", submittedItems: validated.items, apliiqPayload: validated.apliiqPayload });
  row.state = "submitted_processed";
  let updates = 0;
  const service = createFulfillmentService({
    repository: repo,
    square: { getOrder: async () => order, updateShipment: async () => { updates += 1; } },
    apliiq: {
      listOrders: async () => [{ OrderId: "apliiq-1", StoreSystemOrderId: order.id, Status: "Shipped" }],
      getOrder: async () => [{ OrderId: "apliiq-1", StoreSystemOrderId: order.id, Status: "Shipped", SN: [{ TrackingNumber: "1Z", Carrier: "UPS", Items: [{ SKU: "APQ-6208401S7A1", Quantity: 0 }] }] }],
    },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.receiveApliiqFulfillment({ providerOrderId: order.id, eventId: "event-1" })).outcome, "partial");
  assert.equal(updates, 0);
  assert.equal(repo.rows.get(order.id).state, "shipped_partial");
});

test("scheduled reconciliation rotates past eight old pending orders instead of starving later rows", async () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({ square_order_id: `order-${index + 1}`, state: "submitted_processed", submitted_items: [], rank: index }));
  const touched = new Set();
  const repository = {
    async listPendingSquareEvents() { return []; },
    async listQueued() { return []; },
    async listUncertain() { return [...rows].sort((a, b) => a.rank - b.rank).slice(0, 8); },
    async touchReconciliationAttempt(id) { const row = rows.find((entry) => entry.square_order_id === id); row.rank += 100; touched.add(id); },
  };
  const service = createFulfillmentService({
    repository,
    square: {},
    apliiq: {
      listOrders: async () => rows.map((row) => ({ OrderId: `provider-${row.square_order_id}`, StoreSystemOrderId: row.square_order_id, Status: "Preparing" })),
      getOrder: async (id) => ({ OrderId: id, StoreSystemOrderId: id.slice("provider-".length), Status: "Preparing", SN: [] }),
    },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  await service.runScheduled();
  assert.equal(touched.has("order-9"), false);
  await service.runScheduled();
  assert.equal(touched.has("order-9"), true);
});

test("a deadline exhausted during the durable claim releases only an untouched submission", async (t) => {
  const repo = memoryRepository();
  const { payment, order } = paidOrder();
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const claim = repo.claimForSubmission;
  repo.claimForSubmission = async (id) => { const row = await claim(id); clock += 10_000; return row; };
  let posts = 0;
  const service = createFulfillmentService({ repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order },
    apliiq: { createOrder: async () => { posts++; throw new Error("must not post"); } },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquarePayment(payment.id, clock + 8_000)).outcome, "deferred");
  assert.equal(repo.rows.get(order.id).state, "queued");
  assert.equal(posts, 0);
});

test("a queued payload changed before a repeated payment event is held without a supplier POST", async () => {
  const repo = memoryRepository();
  const { payment, order } = paidOrder();
  const validated = validatePaidSquareOrder({ payment, order, locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" });
  await repo.insertValidated({ ...validated, state: "queued", submittedItems: validated.items, payloadSha256: sha256(JSON.stringify(validated.apliiqPayload)) });
  const changed = structuredClone(order);
  changed.fulfillments[0].shipment_details.recipient.address.address_line_1 = "2 Changed Street";
  let posts = 0;
  const service = createFulfillmentService({ repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => changed },
    apliiq: { createOrder: async () => { posts++; throw new Error("must not post"); } },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquarePayment(payment.id)).outcome, "attention");
  assert.equal(posts, 0);
});


test("active fulfillment queues one plain confirmation and one tracking notification without provider email sends", async () => {
  const repo = memoryRepository();
  const calls = [];
  const { payment, order } = paidOrder({ payment: { buyer_email_address: "ada@example.com" } });
  const service = createFulfillmentService({
    repository: repo,
    square: { getPayment: async () => payment, getOrder: async () => order, updateShipment: async () => {} },
    apliiq: {
      createOrder: async () => ({ status: 200, data: { id: "apliiq-1" } }),
      listOrders: async () => [{ OrderId: "apliiq-1", StoreSystemOrderId: order.id, Status: "Shipped" }],
      getOrder: async () => [{ OrderId: "apliiq-1", StoreSystemOrderId: order.id, Status: "Shipped", SN: [{ TrackingNumber: "1ZEMAIL", Carrier: "UPS", Items: [{ SKU: "APQ-6208401S7A1", Quantity: 1 }] }] }],
    },
    notifications: {
      async enqueueConfirmation(value) { calls.push({ kind: "confirmed", value }); },
      async enqueueShipment(value) { calls.push({ kind: "shipped", value }); },
    },
    config: { enabled: "true", locationId: LOCATION, startAt: "2026-10-15T00:00:00.000Z" },
  });
  assert.equal((await service.processSquarePayment(payment.id)).outcome, "submitted_processed");
  assert.equal(calls[0].kind, "confirmed");
  assert.equal(calls[0].value.recipient, "ada@example.com");
  assert.equal((await service.receiveApliiqFulfillment({ providerOrderId: order.id, eventId: "email-event" })).outcome, "shipped");
  assert.deepEqual(calls[1], { kind: "shipped", value: { recipient: "ada@example.com", orderId: order.id, orderNumber: order.reference_id, carrier: "UPS", trackingNumber: "1ZEMAIL", trackingUrl: null } });
});
