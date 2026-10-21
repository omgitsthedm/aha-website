import assert from "node:assert/strict";
import test from "node:test";
import { cleanClientIp, createGoogleDelivery, createMarketingService, createMetaDelivery, googlePurchaseRequest, metaPurchaseRequest, narrowMarketingContext, normalizeMarketingContext, posthogPurchaseAllowed, purchasePayload, restrictMarketingContext } from "../server/analytics/marketing.mjs";

function session(overrides = {}) {
  return {
    checkout_id: "checkout-1", state: "completed", square_order_id: "square-order-1", square_payment_id: "square-payment-1",
    currency: "USD", total_cents: 12000, shipping_cents: 500, tax_cents: 500,
    cart_json: [{ variationId: "VAR-1", quantity: 2, unitAmount: 5500 }],
    marketing_json: {
      paymentConsentConfirmed: true,
      eligibleProviders: ["google", "meta"],
      analytics: { consent: true, gaClientId: "123456.789012", gaSessionId: "1720000000" },
      marketing: { consent: true, gpc: false, userAgent: "Mozilla/5.0 test", clientIp: "203.0.113.9", attribution: { utm: { utm_source: "instagram" }, fbclid: "facebook-click" }, meta: { fbp: "fb.1.1.2", fbc: "fb.1.3.4" } },
    },
    ...overrides,
  };
}

function memoryRepository() {
  const rows = [];
  let current = session();
  return {
    rows,
    setCurrent(value) { current = value; },
    async getCompletedCheckout() { return current; },
    async enqueue(input) {
      const existing = rows.find((row) => row.provider === input.provider && row.square_order_id === input.squareOrderId);
      if (existing) return existing;
      const row = { id: rows.length + 1, provider: input.provider, square_order_id: input.squareOrderId, checkout_id: input.checkoutId, payload_json: input.payload, state: "pending", attempt_count: 0 };
      rows.push(row); return row;
    },
    async claim(limit) { return rows.filter((row) => row.state === "pending").slice(0, limit).map((row) => { row.state = "sending"; row.attempt_count += 1; return row; }); },
    async markSent({ id, attemptCount }) { const row = rows.find((entry) => entry.id === id); if (row?.state !== "sending" || row.attempt_count !== attemptCount) return null; row.state = "sent"; return row; },
    async disable({ id, attemptCount, code }) { const row = rows.find((entry) => entry.id === id); if (row?.state !== "sending" || row.attempt_count !== attemptCount) return null; Object.assign(row, { state: "disabled", last_error_code: code }); return row; },
    async retryOrAttention({ id, attemptCount, code }) { const row = rows.find((entry) => entry.id === id); if (row?.state !== "sending" || row.attempt_count !== attemptCount) return null; Object.assign(row, { state: row.attempt_count >= 5 ? "attention" : "pending", last_error_code: code }); return row; },
  };
}

test("checkout attribution keeps only consented anonymous and bounded fields", () => {
  const context = normalizeMarketingContext({
    analytics: { consent: true, gaClientId: "123456.789012", gaSessionId: "1720000000" },
    marketing: { consent: true, gpc: false, userAgent: "Mozilla/5.0 test", attribution: { utm: { utm_source: "instagram", utm_campaign: "fall 2026" }, gclid: "g-click", landingPath: "/shop/yikes/" }, meta: { fbp: "fb.1.1.2", fbc: "fb.1.3.4" } },
  });
  assert.equal(context.analytics.gaClientId, "123456.789012");
  assert.equal(context.marketing.meta.fbp, "fb.1.1.2");
  assert.equal(context.marketing.userAgent, "Mozilla/5.0 test");
  assert.equal(context.marketing.attribution.utm.utm_campaign, "fall 2026");
  const denied = normalizeMarketingContext({ analytics: { consent: false, gaClientId: "secret" }, marketing: { consent: true, gpc: true, meta: { fbp: "fb.1.1.2" } } });
  assert.equal(denied.analytics.gaClientId, null);
  assert.equal(denied.marketing.consent, false);
  assert.deepEqual(denied.marketing.meta, {});
  assert.deepEqual(denied.marketing.attribution, {});
});

test("payment-time privacy choices can only narrow a quoted marketing context", () => {
  const quote = session().marketing_json;
  const restricted = restrictMarketingContext(quote, { analytics: { consent: true }, marketing: { consent: false, gpc: false } });
  assert.equal(restricted.analytics.consent, true);
  assert.equal(restricted.marketing.consent, false);
  assert.deepEqual(restricted.marketing.meta, {});
  const noLateGrant = restrictMarketingContext({ analytics: { consent: false }, marketing: { consent: false, gpc: false } }, quote);
  assert.equal(noLateGrant.analytics.consent, false);
  assert.equal(noLateGrant.marketing.consent, false);
  const gpc = restrictMarketingContext(quote, { analytics: { consent: true }, marketing: { consent: true, gpc: true } });
  assert.equal(gpc.marketing.consent, false);
  assert.equal(gpc.marketing.gpc, true);
});

test("PostHog purchase capture fails closed when payment-time consent persistence failed", () => {
  const unconfirmed = session({ marketing_json: { ...session().marketing_json, paymentConsentConfirmed: false } });
  assert.equal(posthogPurchaseAllowed(unconfirmed), false);
  assert.equal(posthogPurchaseAllowed(session()), true);
});

test("server requests contain purchase facts and anonymous identifiers, never checkout contact fields", () => {
  const payload = purchasePayload(session());
  const google = googlePurchaseRequest(payload);
  const meta = metaPurchaseRequest(payload);
  assert.equal(google.client_id, "123456.789012");
  assert.equal(google.events[0].params.transaction_id, "square-order-1");
  assert.equal(google.events[0].params.value, 110);
  assert.equal(google.events[0].params.shipping, 5);
  assert.equal(google.events[0].params.tax, 5);
  assert.deepEqual(google.events[0].params.items, [{ item_id: "VAR-1", price: 55, quantity: 2 }]);
  assert.equal(meta.data[0].event_id, "square-order-1");
  assert.equal(meta.data[0].user_data.fbp, "fb.1.1.2");
  assert.equal(meta.data[0].user_data.client_user_agent, "Mozilla/5.0 test");
  assert.equal(meta.data[0].user_data.client_ip_address, "203.0.113.9");
  assert.equal(google.events[0].params.client_ip_address, undefined);
  assert.equal(meta.data[0].event_source_url, "https://afterhoursagenda.com/checkout/");
  assert.equal(meta.data[0].custom_data.value, 110);
  const sent = JSON.stringify({ google, meta });
  for (const forbidden of ["Ada", "@example", "Main Street"]) assert.doesNotMatch(sent, new RegExp(forbidden, "i"));
  assert.doesNotMatch(sent, /"(?:email|address|postal|ip(?:_address)?)"\s*:/i);
});

test("missing provider credentials disable delivery before any network request", async () => {
  let calls = 0;
  const google = createGoogleDelivery({ measurementId: "G-TEST", apiSecret: "", fetchImpl: async () => { calls += 1; return new Response(); } });
  const meta = createMetaDelivery({ datasetId: "1815233516346046", accessToken: "", fetchImpl: async () => { calls += 1; return new Response(); } });
  assert.equal(google.configured, false); assert.equal(meta.configured, false);
  assert.equal(await google.send(purchasePayload(session())), false);
  assert.equal(await meta.send(purchasePayload(session())), false);
  assert.equal(calls, 0);
});

test("Meta does not queue a matchless event and retries preserve the original event time", () => {
  const withoutMatch = purchasePayload(session({ marketing_json: { paymentConsentConfirmed: true, analytics: { consent: true, gaClientId: "123.456" }, marketing: { consent: true, gpc: false, userAgent: "Mozilla/5.0 test", meta: {} } } }), 1_700_000_000_000);
  assert.equal(metaPurchaseRequest(withoutMatch), null);
  const payload = purchasePayload(session(), 1_700_000_000_000);
  assert.equal(metaPurchaseRequest(payload).data[0].event_time, 1_700_000_000);
  assert.equal(googlePurchaseRequest(payload).timestamp_micros, 1_700_000_000_000_000);
  assert.equal(purchasePayload(session({ currency: "CAD" }), 1_700_000_000_000), null);
  assert.equal(purchasePayload(session({ marketing_json: { analytics: { consent: true }, marketing: { consent: true, gpc: false } } }), 1_700_000_000_000), null);
});

test("one confirmed order queues once per configured provider and delivery retries without touching payment", async () => {
  const repository = memoryRepository();
  const calls = [];
  const deliveries = {
    google: { configured: true, async send(payload) { calls.push(["google", payload.orderId]); return true; } },
    meta: { configured: true, async send(payload) { calls.push(["meta", payload.orderId]); throw Object.assign(new Error("down"), { code: "meta_http_503" }); } },
  };
  const service = createMarketingService({ repository, deliveries });
  assert.deepEqual(await service.enqueue(session()), { queued: 2 });
  assert.deepEqual(await service.enqueue(session()), { queued: 2 });
  assert.equal(repository.rows.length, 2);
  assert.deepEqual(await service.dispatch(), { attempted: 2, sent: 1, deferred: 1 });
  assert.equal(repository.rows.find((row) => row.provider === "google").state, "sent");
  assert.equal(repository.rows.find((row) => row.provider === "meta").state, "pending");
  assert.deepEqual(calls, [["google", "square-order-1"], ["meta", "square-order-1"]]);
});

test("a later provider configuration cannot replay a checkout that was ineligible when quoted", async () => {
  const repository = memoryRepository();
  const service = createMarketingService({ repository, deliveries: { google: { configured: true }, meta: { configured: true } } });
  const oldCheckout = session({ marketing_json: { ...session().marketing_json, eligibleProviders: [] } });
  assert.deepEqual(await service.enqueue(oldCheckout), { queued: 0 });
  assert.equal(repository.rows.length, 0);
});

test("a consent withdrawal before dispatch disables the leased row", async () => {
  const repository = memoryRepository();
  const sent = [];
  const service = createMarketingService({ repository, deliveries: { google: { configured: true, async send() { sent.push("google"); return true; } }, meta: { configured: false } } });
  await service.enqueue(session({ marketing_json: { ...session().marketing_json, eligibleProviders: ["google"] } }));
  repository.setCurrent(session({ marketing_json: { ...session().marketing_json, eligibleProviders: ["google"], analytics: { consent: false }, marketing: { consent: false, gpc: false, meta: {}, userAgent: null } } }));
  assert.deepEqual(await service.dispatch(), { attempted: 1, sent: 0, deferred: 0 });
  assert.equal(repository.rows[0].state, "disabled");
  assert.equal(repository.rows[0].last_error_code, "google_permission_revoked");
  assert.deepEqual(sent, []);
});

test("a delayed dispatch retains the verified completion time", async () => {
  const repository = memoryRepository();
  const service = createMarketingService({
    repository,
    deliveries: { google: { configured: true }, meta: { configured: false } },
    now: () => 1_800_000_000_000,
  });
  await service.enqueue(session({ updated_at: "2023-11-14T22:13:20.000Z" }));
  assert.equal(repository.rows[0].payload_json.eventTimeMs, 1_700_000_000_000);
});

test("Meta and Google gateways use secure provider endpoints without customer data", async () => {
  const seen = [];
  const payload = purchasePayload(session());
  const google = createGoogleDelivery({ measurementId: "G-ABCDE", apiSecret: "server-secret", fetchImpl: async (url, init) => { seen.push({ url, body: init.body }); return new Response(null, { status: 204 }); } });
  const meta = createMetaDelivery({ datasetId: "1815233516346046", accessToken: "meta-secret", fetchImpl: async (url, init) => { seen.push({ url, body: init.body }); return new Response('{"events_received":1}', { status: 200 }); } });
  assert.equal(await google.send(payload), true); assert.equal(await meta.send(payload), true);
  assert.match(seen[0].url, /^https:\/\/www\.google-analytics\.com\/mp\/collect\?/);
  assert.match(seen[1].url, /^https:\/\/graph\.facebook\.com\/v26\.0\/1815233516346046\/events\?/);
  const bodies = JSON.stringify(seen.map((entry) => entry.body));
  assert.doesNotMatch(bodies, /secret/i);
  assert.doesNotMatch(bodies, /"(?:email|address|postal|ip(?:_address)?)"\s*:/i);
});

test("Meta leaves an unaccepted provider response retryable without customer data", async () => {
  const meta = createMetaDelivery({ datasetId: "1815233516346046", accessToken: "meta-secret", fetchImpl: async () => new Response('{"events_received":0}', { status: 200 }) });
  await assert.rejects(meta.send(purchasePayload(session())), (error) => error?.code === "meta_not_accepted");
});

test("the connecting address is kept only as a valid IP literal and only with marketing consent", () => {
  assert.equal(cleanClientIp("203.0.113.9"), "203.0.113.9");
  assert.equal(cleanClientIp(" 2001:db8::1 "), "2001:db8::1");
  for (const bad of ["999.1.1.1", "203.0.113.9, 10.0.0.1", "localhost", "ada@example.com", "2001:db8", "", 12, null]) assert.equal(cleanClientIp(bad), null, String(bad));
  const granted = normalizeMarketingContext({ marketing: { consent: true, gpc: false, userAgent: "Mozilla/5.0 test", clientIp: "203.0.113.9" } });
  assert.equal(granted.marketing.clientIp, "203.0.113.9");
  const optedOut = normalizeMarketingContext({ marketing: { consent: false, gpc: false, clientIp: "203.0.113.9" } });
  assert.equal(optedOut.marketing.clientIp, null);
  const gpc = normalizeMarketingContext({ marketing: { consent: true, gpc: true, clientIp: "203.0.113.9" } });
  assert.equal(gpc.marketing.clientIp, null);
});

test("a later opt-out removes the stored address from the Meta purchase event", () => {
  const quote = session().marketing_json;
  const restricted = restrictMarketingContext(quote, { analytics: { consent: true }, marketing: { consent: false, gpc: false } });
  assert.equal(restricted.marketing.clientIp, null);
  const kept = restrictMarketingContext(quote, { analytics: { consent: true }, marketing: { consent: true, gpc: false } });
  assert.equal(kept.marketing.clientIp, "203.0.113.9");
  const narrowed = narrowMarketingContext(quote, { analytics: true, marketing: false, gpc: false });
  assert.equal(narrowed.marketing.clientIp, null);
  const withoutIp = metaPurchaseRequest(purchasePayload(session({ marketing_json: { ...quote, marketing: { ...quote.marketing, clientIp: null } } })));
  assert.equal("client_ip_address" in withoutIp.data[0].user_data, false);
});
