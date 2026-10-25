import test from "node:test";
import assert from "node:assert/strict";
import { handleSupport } from "../server/support/request.mjs";
import { issueSupportChallenge } from "../server/support/challenge.mjs";
import { CLIENT, SITE_ORIGIN } from "../server/platform/client.mjs";

const input = { requestId: "10000000-0000-4000-8000-000000000001", name: "Test Buyer", email: "buyer@example.com", topic: "returns", reference: "ORDER1", message: "I would like help with an exchange." };
const request = (values = input, headers = {}) => new Request(`${SITE_ORIGIN}/api/support`, { method: "POST", headers: { origin: SITE_ORIGIN, "content-type": "application/json", "x-aha-support": "1", ...headers }, body: JSON.stringify(values) });
function fixture(attempts = 0) {
  const sent = [], queried = [], challenges = new Set(), rateAttempts = new Map(), locks = new Map();
  const db = { sql: async (parts, ...params) => {
    const sql = parts.join("?");
    queried.push({ sql, params });
    if (/SELECT count/.test(sql)) return [{ attempts }];
    if (/INSERT INTO aha_signup_attempts/.test(sql)) challenges.add(params[0]);
    if (/RETURNING client_key/.test(sql)) return challenges.delete(params[0]) ? [{ client_key: params[0] }] : [];
    return [];
  }, pool: { connect: async () => {
    const unlocks = [];
    return {
      query: async (sql, params = []) => {
        queried.push({ sql, params });
        if (/pg_advisory_xact_lock/.test(sql)) {
          const key = params[0];
          const previous = locks.get(key) ?? Promise.resolve();
          const next = new Promise((resolve) => { unlocks.push(resolve); });
          locks.set(key, previous.then(() => next));
          await previous;
          return { rows: [] };
        }
        if (/SELECT count/.test(sql)) return { rows: [{ attempts: rateAttempts.get(params[0]) ?? attempts }] };
        if (/INSERT INTO aha_signup_attempts/.test(sql)) rateAttempts.set(params[0], (rateAttempts.get(params[0]) ?? attempts) + 1);
        if (/COMMIT|ROLLBACK/.test(sql)) unlocks.splice(0).forEach((unlock) => unlock());
        return { rows: [] };
      },
      release: () => unlocks.splice(0).forEach((unlock) => unlock()),
    };
  } } };
  return { sent, queried, db, gateway: { send: async (message) => { sent.push(message); return { id: "local-provider-receipt" }; } }, clientKey: "local-fixture", challengeSecret: "test-support-challenge-secret", now: 5_000 };
}
async function securedInput(deps, values = input) {
  const challenge = await issueSupportChallenge({ db: deps.db, secret: deps.challengeSecret, clientKey: deps.clientKey, now: 1_000 });
  return { ...values, challenge: challenge.token };
}

test("support receives a signed form submission to the fixed owner inbox and escapes input", async () => {
  const deps = fixture();
  const values = await securedInput(deps, { ...input, message: "<script>unsafe</script> Please help with my size.", recipient: "other@example.com" });
  assert.equal((await handleSupport(request(values), deps)).status, 200);
  assert.equal(deps.sent[0].recipient, CLIENT.client.email);
  assert.equal(deps.sent[0].replyTo, input.email);
  assert.ok(!deps.sent[0].html.includes("<script>"));
  assert.ok(deps.sent[0].text.includes("<script>"));
  assert.ok(!JSON.stringify(deps.queried).includes(input.email));
});

test("support rejects forged, malformed and replayed form challenges without sending", async () => {
  const deps = fixture();
  const values = await securedInput(deps);
  for (const challenge of [undefined, "forged", "x".repeat(601), 7]) {
    assert.equal((await handleSupport(request({ ...values, challenge }), deps)).status, 403);
  }
  assert.equal((await handleSupport(request(values), deps)).status, 200);
  assert.equal((await handleSupport(request(values), deps)).status, 403);
  assert.equal(deps.sent.length, 1);
});

test("support serializes concurrent signed submissions into the durable five-per-hour quota", async () => {
  const deps = fixture();
  const values = await Promise.all(Array.from({ length: 6 }, (_, index) => securedInput(deps, { ...input, requestId: `10000000-0000-4000-8000-00000000000${index + 1}` })));
  const responses = await Promise.all(values.map((value) => handleSupport(request(value), deps)));
  assert.equal(responses.filter((response) => response.status === 200).length, 5);
  assert.equal(responses.filter((response) => response.status === 429).length, 1);
  assert.equal(deps.sent.length, 5);
});

test("support rejects origin, oversized body, invalid fields and excess attempts without sending", async () => {
  const limited = fixture(5);
  for (const [req, deps, status] of [
    [request(input, { origin: "https://other.example" }), fixture(), 403],
    [request({ ...input, message: "x".repeat(9000) }), fixture(), 413],
    [request({ ...input, email: "bad" }), fixture(), 422],
    [request(await securedInput(limited)), limited, 429],
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
  const values = await securedInput(deps);
  const unavailable = await handleSupport(request(values), { ...deps, gateway: null });
  assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /confirm receipt/);
  const silent = await handleSupport(request(await securedInput(deps)), { ...deps, gateway: { send: async () => ({}) } });
  assert.equal(silent.status, 503);
});

test("valid challenges cannot deliver the repeated random-text spam pattern", async () => {
  // Synthetic variants of the observed pattern; no sender addresses or private
  // mailbox contents are kept in the public repository.
  for (const fields of [
    { name: "qAzWsXeDcRfVtGbY", message: "pOlIkUjYhTgRfEdWsQaZ", reference: "mNbVcXzAsDfGhJkL" },
    { name: "qAzWsXeDcRfVtGbY", message: "pOlIkUjYhTgRfEdWsQaZ", reference: "" },
    { name: "Test Buyer", message: "pOlIkUjYhTgRfEdWsQaZ", reference: "mNbVcXzAsDfGhJkL" },
  ]) {
    const deps = fixture();
    const values = await securedInput(deps, { ...input, topic: "order", ...fields });
    const queriesBefore = deps.queried.length;
    const response = await handleSupport(request(values), deps);
    assert.equal(response.status, 422);
    const result = await response.json();
    assert.equal(result.ok, undefined);
    assert.match(result.error, /short sentence/);
    assert.equal(deps.sent.length, 0);
    assert.equal(deps.queried.length, queriesBefore, "rejected content reaches neither database claims nor the mail gateway");
  }
});

test("support preserves legitimate short, international and order-reference-only context", async () => {
  for (const fields of [
    { name: "McKenzie MacDonald", message: "Where is my order?", reference: "qAzWsXeDcRfVtGbY" },
    { name: "MaryAnnMcDonald", message: "Please help with my order.", reference: "mNbVcXzAsDfGhJkL" },
    { name: "Test Buyer", message: "Unsubscribe", reference: "" },
    { name: "山田太郎", message: "注文した商品の配送状況を教えてください。", reference: "" },
    { name: "ชลธิชา", message: "ต้องการสอบถามสถานะการจัดส่งสินค้าของฉัน", reference: "" },
    { name: "Test Buyer", message: "SCREEN READER DOES NOT ANNOUNCE THE SIZE.", reference: "" },
    { name: "qAzWsXeDcRfVtGbY", message: "Please help me find my order confirmation.", reference: "" },
    { name: "Test Buyer", message: "pOlIkUjYhTgRfEdWsQaZ", reference: "" },
  ]) {
    const deps = fixture();
    const values = await securedInput(deps, { ...input, ...fields });
    assert.equal((await handleSupport(request(values), deps)).status, 200, JSON.stringify(fields));
    assert.equal(deps.sent.length, 1);
  }
});
