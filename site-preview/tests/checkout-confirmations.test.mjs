import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createCheckoutConfirmations } from '../server/notifications/checkout-confirmations.mjs';
import { createNotificationService } from '../server/notifications/service.mjs';
import { createNotificationRepository } from '../server/notifications/repository.mjs';

async function setup(t, state = 'completed') {
  const pg = new PGlite(); t.after(() => pg.close());
  for (const name of ['20261015045000_yikes_fulfillment', '20261015160000_custom_checkout', '20261015170000_order_notifications', '20261015180000_checkout_payment_recovery']) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), 'utf8'));
  const database = { sql: async (strings, ...values) => (await pg.query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, ''), values)).rows };
  await pg.query(`INSERT INTO aha_checkout_sessions (checkout_id,token_sha256,state,currency,cart_json,shipping_address_json,order_payload_json,subtotal_cents,shipping_cents,tax_cents,total_cents,order_idempotency_key,expires_at,square_order_id,square_payment_id,payment_submission_started_at)
    VALUES ('checkout-test','hash',$1,'USD','[{"variationId":"464AETWT7Q2JEAPKDDJ6KLJQ","product":"insomniac_ss4500_black","size":"XL","quantity":1}]','{"email":"customer@example.com"}','{}',5800,0,470,6270,'order-key',now(),'order-test',$2,now())`, [state, state === 'completed' ? 'payment-test' : null]);
  const repository = createNotificationRepository(database);
  const sent = [];
  const service = createNotificationService({ repository, config: { enabled: true, apiKey: 'test-only', from: 'store@example.com', replyTo: 'store@example.com' }, gateway: { send: async (message) => { sent.push(message); return { id: 'fake-message' }; } } });
  const values = { AHA_FULFILLMENT_ENABLED: 'false', AHA_SQUARE_ACCESS_TOKEN: 'test-only', AHA_SQUARE_LOCATION_ID: 'location-test' };
  const payment = { id: 'payment-test', status: 'COMPLETED', order_id: 'order-test', location_id: 'location-test', amount_money: { amount: 6270, currency: 'USD' } };
  const square = { getPayment: async () => payment };
  const confirmations = createCheckoutConfirmations({ database, service, env: { get: (key) => values[key] }, square });
  return { pg, database, service, sent, payment, confirmations };
}

test('paused fulfillment cannot suppress a verified payment receipt; repeated paths send once', async (t) => {
  const ctx = await setup(t);
  await ctx.confirmations.queueCheckout('checkout-test');
  await ctx.confirmations.queueSquarePayment('payment-test');
  await ctx.confirmations.queueCheckout('checkout-test');
  assert.equal((await ctx.pg.query('SELECT * FROM aha_order_notifications')).rows.length, 1);
  await ctx.service.dispatch();
  assert.equal(ctx.sent.length, 1);
  assert.match(ctx.sent[0].text, /Insomniac Hoodie — Black \/ XL/);
  assert.match(ctx.sent[0].text, /\$62.70/);
  assert.doesNotMatch(ctx.sent[0].text, /preparing|in production/);
});

test('a lost browser response is recovered by the verified completed payment', async (t) => {
  const ctx = await setup(t, 'unknown');
  assert.equal(await ctx.confirmations.queueCheckout('checkout-test'), null);
  await ctx.confirmations.queueSquarePayment('payment-test');
  assert.equal((await ctx.pg.query('SELECT state FROM aha_checkout_sessions')).rows[0].state, 'completed');
  assert.equal((await ctx.pg.query('SELECT * FROM aha_order_notifications')).rows.length, 1);
});

for (const [field, value] of [['status', 'FAILED'], ['location_id', 'other-location'], ['order_id', 'pos-order'], ['amount_money', { amount: 1, currency: 'USD' }], ['amount_money', { amount: 6270, currency: 'CAD' }]]) {
  test(`does not create a receipt for mismatched ${field} or noncompleted payment`, async (t) => {
    const ctx = await setup(t, 'unknown'); ctx.payment[field] = value;
    await ctx.confirmations.queueSquarePayment('payment-test');
    assert.equal((await ctx.pg.query('SELECT * FROM aha_order_notifications')).rows.length, 0);
    assert.equal((await ctx.pg.query('SELECT state FROM aha_checkout_sessions')).rows[0].state, 'unknown');
  });
}

test('hourly recovery repairs missing receipts and does not enqueue duplicates', async (t) => {
  const ctx = await setup(t);
  assert.equal(await ctx.confirmations.recoverMissing(), 1);
  assert.equal(await ctx.confirmations.recoverMissing(), 0);
});
