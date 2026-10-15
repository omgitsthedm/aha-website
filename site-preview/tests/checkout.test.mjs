import assert from "node:assert/strict";
import test from "node:test";
import { createCheckoutService } from "../server/checkout/service.mjs";
import { CheckoutError } from "../server/checkout/errors.mjs";

const crewM = "R5UCZCGSJMR3Z4HJDVOD3ZIK";
const hoodieL = "4HDYVGQA3ZOGIPYFUCTPKPIV";
const config = { locationId: "FGKRPYEXNV482" };
const fixedNow = () => Date.parse("2026-10-15T18:00:00.000Z");

function fakeRepo() {
  const rows = new Map();
  return {
    rows,
    async create(record) { const row = { checkout_id: record.checkoutId, token_sha256: record.tokenHash, state: "quoted", currency: record.currency, cart_json: record.cart, shipping_address_json: record.address, order_payload_json: record.orderPayload, subtotal_cents: record.subtotalCents, shipping_cents: record.shippingCents, tax_cents: record.taxCents, total_cents: record.totalCents, tax_label: record.taxLabel, order_idempotency_key: record.orderIdempotencyKey, expires_at: record.expiresAt, square_order_id: null, square_payment_id: null, payment_idempotency_key: null, processing_lease_expires_at: null, last_error_code: null }; rows.set(record.checkoutId, row); return row; },
    async get(id) { return rows.get(id) ?? null; },
    async cancelUnclaimedRecovery({ checkoutId, tokenHash }) { const row = rows.get(checkoutId); if (!row || row.token_sha256 !== tokenHash || row.state !== "quoted") return null; Object.assign(row, { state: "failed", last_error_code: "payment_not_started", processing_lease_expires_at: null }); return row; },
    async claim({ checkoutId, tokenHash, clientIdempotencyKey }) { const row = rows.get(checkoutId); if (!row || row.token_sha256 !== tokenHash || row.state !== "quoted") return null; row.state = "processing"; row.payment_idempotency_key = clientIdempotencyKey; row.processing_lease_expires_at = new Date(fixedNow() + 90_000).toISOString(); return row; },
    async releaseClaim({ checkoutId, code }) { const row = rows.get(checkoutId); row.state = "quoted"; row.last_error_code = code; return row; },
    async saveOrder({ checkoutId, orderId }) { const row = rows.get(checkoutId); row.square_order_id = orderId; return row; },
    async complete({ checkoutId, orderId, paymentId, receiptUrl = null }) { const row = rows.get(checkoutId); Object.assign(row, { state: "completed", square_order_id: orderId, square_payment_id: paymentId, square_receipt_url: receiptUrl, last_error_code: null }); return row; },
    async fail({ checkoutId, code }) { const row = rows.get(checkoutId); Object.assign(row, { state: "failed", last_error_code: code }); return row; },
    async unknown({ checkoutId, code, orderId = null }) { const row = rows.get(checkoutId); Object.assign(row, { state: "unknown", square_order_id: orderId ?? row.square_order_id, last_error_code: code }); return row; },
  };
}
function calculated(order) {
  const subtotal = order.line_items.reduce((sum, line) => sum + ({ [crewM]: 5200, [hoodieL]: 5500 }[line.catalog_object_id] * Number(line.quantity)), 0);
  const shipping = order.service_charges?.[0]?.amount_money.amount ?? 0;
  const tax = order.taxes?.length ? Math.round(subtotal * 0.081) : 0;
  return { ...order, total_tax_money: { amount: tax, currency: "USD" }, total_money: { amount: subtotal + shipping + tax, currency: "USD" } };
}
function fakeSquare() {
  const calls = { calculate: [], createOrder: [], createPayment: [] };
  return { calls,
    async calculateOrder(order) { calls.calculate.push(order); return calculated(order); },
    async createOrder(order, idempotencyKey) { calls.createOrder.push({ order, idempotencyKey }); return { ...calculated(order), id: "order-1" }; },
    async createPayment(payment) { calls.createPayment.push(payment); return { id: "payment-1", status: "COMPLETED", order_id: payment.order_id, location_id: payment.location_id, amount_money: payment.amount_money, receipt_url: "https://squareup.com/receipt/test" }; },
    async getOrder() { return { tenders: [] }; },
    async getPayment() { return null; },
  };
}
function address(overrides = {}) { return { firstName: "Ada", lastName: "Lovelace", addressLine1: "1 Main Street", city: "Peoria", region: "AZ", postalCode: "85345", country: "US", email: "ada@example.com", ...overrides }; }
function service() { const repository = fakeRepo(); const square = fakeSquare(); let number = 0; return { repository, square, service: createCheckoutService({ repository, square, config, now: fixedNow, createId: () => `checkout-${++number}` }) }; }

test("quotes the exact current Yikes variants with owner-approved Arizona tax and no catalog auto-tax", async () => {
  const ctx = service();
  const quote = await ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }, { variationId: hoodieL, quantity: 1 }], shippingAddress: address() });
  assert.equal(quote.subtotalAmount, 10_700); assert.equal(quote.shippingAmount, 0); assert.equal(quote.taxAmount, 867); assert.equal(quote.totalAmount, 11_567);
  assert.equal(ctx.square.calls.calculate[0].taxes[0].percentage, "8.1");
  assert.equal(ctx.square.calls.calculate[0].pricing_options, undefined);
  assert.equal(ctx.square.calls.calculate[0].fulfillments.length, 1);
});

test("quotes free domestic shipping and flat supported-international shipping", async () => {
  const ctx = service();
  const ny = await ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: address({ region: "New York", postalCode: "10001" }) });
  assert.deepEqual([ny.subtotalAmount, ny.shippingAmount, ny.taxAmount, ny.totalAmount], [5200, 0, 0, 5200]);
  const canada = await ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: address({ country: "CA", region: "Ontario", postalCode: "M5V 2T6" }) });
  assert.deepEqual([canada.subtotalAmount, canada.shippingAmount, canada.taxAmount, canada.totalAmount], [5200, 2500, 0, 7700]);
});

test("rejects unknown variants and unsupported destinations before a Square call", async () => {
  const ctx = service();
  await assert.rejects(ctx.service.quote({ items: [{ variationId: "AAAAAAAAAAAAAAAAAAAA", quantity: 1 }], shippingAddress: address() }), (e) => e instanceof CheckoutError && e.code === "invalid_cart");
  await assert.rejects(ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: address({ country: "BR" }) }), (e) => e instanceof CheckoutError && e.code === "unsupported_destination");
  await assert.rejects(ctx.service.quote({ items: [{ variationId: crewM, quantity: 11 }], shippingAddress: address() }), (e) => e instanceof CheckoutError && e.code === "invalid_cart");
  const { email, ...withoutEmail } = address();
  await assert.rejects(ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: withoutEmail }), (e) => e instanceof CheckoutError && e.code === "invalid_address");
  assert.equal(ctx.square.calls.calculate.length, 0);
});

test("creates a Square order and matching payment once, binding amount, order and location", async () => {
  const ctx = service();
  const quote = await ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }, { variationId: hoodieL, quantity: 1 }], shippingAddress: address() });
  const result = await ctx.service.pay({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, sourceId: "cnon:card-nonce-ok", idempotencyKey: "client-idempotency-key-0001" });
  assert.deepEqual(result, { state: "completed", checkoutId: quote.checkoutId, orderId: "order-1", paymentId: "payment-1", receiptUrl: "https://squareup.com/receipt/test" });
  assert.equal(ctx.square.calls.createOrder.length, 1); assert.equal(ctx.square.calls.createPayment.length, 1);
  const payment = ctx.square.calls.createPayment[0];
  assert.deepEqual(payment.amount_money, { amount: 11_567, currency: "USD" }); assert.equal(payment.order_id, "order-1"); assert.equal(payment.location_id, config.locationId); assert.equal(payment.buyer_email_address, "ada@example.com");
  const retry = await ctx.service.pay({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, sourceId: "ignored-after-completion", idempotencyKey: "client-idempotency-key-0001" });
  assert.equal(retry.state, "completed"); assert.equal(ctx.square.calls.createPayment.length, 1);
});

test("does not retry an ambiguous processor outcome", async () => {
  const ctx = service();
  ctx.square.createPayment = async () => { throw new Error("timeout"); };
  const quote = await ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: address({ region: "NY", postalCode: "10001" }) });
  const first = await ctx.service.pay({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, sourceId: "cnon:card-nonce-ok", idempotencyKey: "client-idempotency-key-0002" });
  assert.equal(first.state, "pending");
  const status = await ctx.service.status({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken });
  assert.equal(status.state, "unknown");
});

test("recovery closes an unclaimed quote before a late payment can reach Square", async () => {
  const ctx = service();
  const quote = await ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: address({ region: "NY", postalCode: "10001" }) });
  const recovered = await ctx.service.status({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken });
  assert.deepEqual(recovered, { state: "failed", checkoutId: quote.checkoutId, orderId: undefined, paymentId: undefined, receiptUrl: undefined, error: "payment_not_started" });
  await assert.rejects(
    ctx.service.pay({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, sourceId: "cnon:card-nonce-ok", idempotencyKey: "client-idempotency-key-0004" }),
    (error) => error instanceof CheckoutError && error.code === "quote_stale",
  );
  assert.equal(ctx.square.calls.createOrder.length, 0);
  assert.equal(ctx.square.calls.createPayment.length, 0);
});


test("status recovers a completed payment without ever replaying the source token", async () => {
  const ctx = service();
  const quote = await ctx.service.quote({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: address({ region: "NY", postalCode: "10001" }) });
  const row = ctx.repository.rows.get(quote.checkoutId);
  Object.assign(row, { state: "unknown", square_order_id: "order-1", last_error_code: "payment_outcome_unknown" });
  ctx.square.getOrder = async () => ({ tenders: [{ payment_id: "payment-recovered" }] });
  ctx.square.getPayment = async (paymentId) => ({ id: paymentId, status: "COMPLETED", order_id: "order-1", location_id: config.locationId, amount_money: { amount: 5200, currency: "USD" }, receipt_url: "https://squareup.com/receipt/recovered" });
  const outcome = await ctx.service.status({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken });
  assert.deepEqual(outcome, { state: "completed", checkoutId: quote.checkoutId, orderId: "order-1", paymentId: "payment-recovered", receiptUrl: "https://squareup.com/receipt/recovered", error: undefined });
  assert.equal(ctx.square.calls.createPayment.length, 0);
});
