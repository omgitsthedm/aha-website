import test from "node:test";
import assert from "node:assert/strict";
import { handleSupport } from "../server/support/request.mjs";
import { CLIENT, SITE_ORIGIN } from "../server/platform/client.mjs";

const input = { requestId: "10000000-0000-4000-8000-000000000001", name: "Test Buyer", email: "buyer@example.com", topic: "returns", reference: "ORDER1", message: "I would like help with an exchange." };
const request = (values = input, headers = {}) => new Request(`${SITE_ORIGIN}/api/support`, { method: "POST", headers: { origin: SITE_ORIGIN, "content-type": "application/json", "x-aha-support": "1", ...headers }, body: JSON.stringify(values) });
function fixture(attempts = 0) {
  const sent = [], queried = [];
  return { sent, queried, db: { sql: async (parts, ...params) => { const sql = parts.join("?"); queried.push({ sql, params }); return /SELECT count/.test(sql) ? [{ attempts }] : []; } }, gateway: { send: async (message) => { sent.push(message); return { id: "local-provider-receipt" }; } }, clientKey: "local-fixture" };
}

test("support receives to the fixed owner inbox, escapes input and deduplicates identical retries", async () => {
  const deps = fixture();
  const values = { ...input, message: "<script>unsafe</script> Please help with my size.", recipient: "other@example.com" };
  assert.equal((await handleSupport(request(values), deps)).status, 200);
  assert.equal((await handleSupport(request(values), deps)).status, 200);
  assert.equal(deps.sent[0].recipient, CLIENT.client.email);
  assert.equal(deps.sent[0].replyTo, input.email);
  assert.ok(!deps.sent[0].html.includes("<script>"));
  assert.ok(deps.sent[0].text.includes("<script>"));
  assert.equal(deps.sent[0].idempotencyKey, deps.sent[1].idempotencyKey);
  assert.ok(!JSON.stringify(deps.queried).includes(input.email));
});

test("support rejects origin, oversized body, invalid fields and excess attempts without sending", async () => {
  for (const [req, deps, status] of [
    [request(input, { origin: "https://other.example" }), fixture(), 403],
    [request({ ...input, message: "x".repeat(9000) }), fixture(), 413],
    [request({ ...input, email: "bad" }), fixture(), 422],
    [request(input), fixture(5), 429],
  ]) {
    assert.equal((await handleSupport(req, deps)).status, status);
    assert.equal(deps.sent.length, 0);
  }
});

test("support rejects a chunked oversized body before a provider send", async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(8193))); } });
  const req = new Request(`${SITE_ORIGIN}/api/support`, {
    method: "POST", duplex: "half", body: stream,
    headers: { origin: SITE_ORIGIN, "content-type": "application/json", "x-aha-support": "1" },
  });
  const deps = fixture();
  assert.equal((await handleSupport(req, deps)).status, 413);
  assert.equal(deps.sent.length, 0);
});

test("support never confirms delivery if sender is unavailable or lacks an acknowledgement", async () => {
  const deps = fixture();
  const unavailable = await handleSupport(request(), { ...deps, gateway: null });
  assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /confirm receipt/);
  const silent = await handleSupport(request(), { ...deps, gateway: { send: async () => ({}) } });
  assert.equal(silent.status, 503);
});
