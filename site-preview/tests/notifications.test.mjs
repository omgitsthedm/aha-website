import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationService } from "../server/notifications/service.mjs";
import { renderShipment } from "../server/notifications/templates.mjs";
import { createResendGateway } from "../server/notifications/resend.mjs";

function memoryRepository() {
  const rows = [];
  return {
    rows,
    async enqueue(record) {
      const existing = rows.find((row) => row.dedupe_key === record.dedupeKey);
      if (existing) return existing;
      const row = { id: rows.length + 1, dedupe_key: record.dedupeKey, kind: record.kind, recipient: record.recipient, payload_json: record.payload, state: "pending", attempt_count: 0 };
      rows.push(row); return row;
    },
    async claim(limit) {
      return rows.filter((row) => row.state === "pending").slice(0, limit).map((row) => { row.state = "sending"; row.attempt_count += 1; return row; });
    },
    async markSent({ id, providerMessageId }) { const row = rows.find((item) => item.id === id); row.state = "sent"; row.provider_message_id = providerMessageId; return row; },
    async retryOrAttention({ id, code }) { const row = rows.find((item) => item.id === id); row.state = row.attempt_count >= 5 ? "attention" : "pending"; row.last_error_code = code; return row; },
  };
}
function configured(repository, gateway, options = {}) {
  return createNotificationService({ repository, gateway, config: { enabled: true, apiKey: "key", from: "After Hours Agenda <orders@afterhoursagenda.com>", replyTo: "info@afterhoursagenda.com" }, ...options });
}

test("active transactional outbox deduplicates confirmation and sends it with a stable provider key", async () => {
  const repository = memoryRepository();
  const sent = [];
  const service = configured(repository, { async send(input) { sent.push(input); return { id: "resend-1" }; }, async listDomains() { return { data: [] }; } });
  await service.enqueueConfirmation({ recipient: "ada@example.com", orderId: "square-1", orderNumber: "AHA-1", totalAmount: 5200, currency: "USD", items: [{ title: "Yikes Crewneck", size: "M", quantity: 1 }] });
  await service.enqueueConfirmation({ recipient: "ada@example.com", orderId: "square-1", orderNumber: "AHA-1", totalAmount: 5200, currency: "USD", items: [{ title: "Yikes Crewneck", size: "M", quantity: 1 }] });
  assert.equal(repository.rows.length, 1);
  assert.deepEqual(await service.dispatch(), { configured: true, attempted: 1, sent: 1, deferred: 0 });
  assert.equal(sent[0].idempotencyKey, "square-1:order_confirmed");
  assert.equal(sent[0].recipient, "ada@example.com");
  assert.match(sent[0].subject, /Your order is in/);
  assert.match(sent[0].text, /payment is confirmed/i);
  assert.doesNotMatch(sent[0].text, /moving into production/i);
  assert.equal(repository.rows[0].state, "sent");
});

test("dispatcher leaves unclaimed rows pending when its scheduled-run budget is exhausted", async () => {
  const repository = memoryRepository();
  await repository.enqueue({ dedupeKey: "square-budget-1:order_confirmed", kind: "order_confirmed", recipient: "ada@example.com", payload: { orderNumber: "AHA-budget-1" } });
  await repository.enqueue({ dedupeKey: "square-budget-2:order_confirmed", kind: "order_confirmed", recipient: "ada@example.com", payload: { orderNumber: "AHA-budget-2" } });
  let clock = 0;
  const service = configured(repository, { async send() { clock = 20_001; return { id: "resend-budget" }; }, async listDomains() { return { data: [] }; } }, { now: () => clock });
  assert.deepEqual(await service.dispatch(8), { configured: true, attempted: 1, sent: 1, deferred: 0 });
  assert.equal(repository.rows[0].state, "sent");
  assert.equal(repository.rows[1].state, "pending");
});

test("a delivery failure stays bounded, reuses the same idempotency key, and then requires attention", async () => {
  const repository = memoryRepository();
  const keys = [];
  const service = configured(repository, { async send(input) { keys.push(input.idempotencyKey); throw new Error("network"); }, async listDomains() { return { data: [] }; } });
  await service.enqueueShipment({ recipient: "ada@example.com", orderId: "square-2", orderNumber: "AHA-2", carrier: "UPS", trackingNumber: "1ZTEST", trackingUrl: "https://example.test/1ZTEST" });
  for (let index = 0; index < 5; index += 1) await service.dispatch();
  assert.deepEqual(keys, Array(5).fill("square-2:order_shipped:1ZTEST"));
  assert.equal(repository.rows[0].state, "attention");
  assert.equal(repository.rows[0].last_error_code, "resend_delivery_unknown");
});

test("shipment copy reports tracking availability without claiming a carrier handoff", () => {
  const message = renderShipment({ orderNumber: "AHA-3", carrier: "UPS", trackingNumber: "1ZTEST" });
  assert.match(message.text, /Tracking is now available/i);
  assert.match(message.text, /may need a little time before scans/i);
  assert.doesNotMatch(message.text, /handed to the carrier/i);
});

test("health reports a safe provider status without surfacing provider error text", async () => {
  const repository = memoryRepository();
  const service = configured(repository, { async send() { return { id: "unused" }; }, async listDomains() { const error = new Error("private provider detail"); error.status = 403; throw error; } });
  assert.deepEqual(await service.health(), { configured: true, providerReachable: false, senderVerified: false, providerStatus: "resend_http_403" });
});

test("health recognizes a valid sending-only credential without claiming it can inspect the sender domain", async () => {
  const repository = memoryRepository();
  const service = configured(repository, { async send() { return { id: "unused" }; }, async listDomains() { const error = new Error("resend_request_failed"); error.status = 401; error.resendReason = "restricted_api_key"; throw error; } });
  assert.deepEqual(await service.health(), { configured: true, providerReachable: true, senderVerified: null, providerStatus: "sending_only_key" });
});

test("Resend gateway classifies only the known sending-key restriction and keeps provider detail private", async () => {
  const gateway = createResendGateway({ apiKey: "secret", from: "After Hours Agenda <orders@afterhoursagenda.com>", replyTo: "info@afterhoursagenda.com", fetchImpl: async () => new Response(JSON.stringify({ name: "restricted_api_key", message: "private provider detail" }), { status: 401 }) });
  await assert.rejects(gateway.listDomains(), (error) => error.status === 401 && error.resendReason === "restricted_api_key" && error.message === "resend_request_failed");
});

test("Resend gateway sends no provider token to the browser and keeps only a request authorization header", async () => {
  let received;
  const gateway = createResendGateway({ apiKey: "secret", from: "After Hours Agenda <orders@afterhoursagenda.com>", replyTo: "info@afterhoursagenda.com", fetchImpl: async (url, init) => { received = { url, init }; return new Response(JSON.stringify({ id: "email-1" }), { status: 200 }); } });
  await gateway.send({ idempotencyKey: "square-3:order_confirmed", recipient: "ada@example.com", subject: "Order", html: "<p>Order</p>", text: "Order" });
  assert.equal(received.url, "https://api.resend.com/emails");
  assert.equal(received.init.headers.authorization, "Bearer secret");
  assert.equal(received.init.headers["idempotency-key"], "square-3:order_confirmed");
  assert.doesNotMatch(received.init.body, /secret/);
  assert.equal(JSON.parse(received.init.body).reply_to, "info@afterhoursagenda.com", "transactional mail keeps the configured reply address");
});

test("Resend gateway allows the support sender to supply its validated reply address", async () => {
  let received;
  const gateway = createResendGateway({ apiKey: "secret", from: "After Hours Agenda <orders@afterhoursagenda.com>", replyTo: "info@afterhoursagenda.com", fetchImpl: async (_url, init) => { received = init; return new Response(JSON.stringify({ id: "email-1" }), { status: 200 }); } });
  await gateway.send({ idempotencyKey: "support-1", recipient: "info@afterhoursagenda.com", replyTo: "buyer@example.com", subject: "Support", html: "<p>Support</p>", text: "Support" });
  assert.equal(JSON.parse(received.body).reply_to, "buyer@example.com");
});
