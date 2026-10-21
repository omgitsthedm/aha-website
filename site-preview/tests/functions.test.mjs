import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import squareWebhook from '../netlify/functions/square-webhook.mjs';
import apliiqWebhook from '../netlify/functions/apliiq-fulfillment-webhook.mjs';
import health from '../netlify/functions/fulfillment-health.mjs';
import { config as quoteConfig } from '../netlify/functions/checkout-quote.mjs';
import { config as estimateConfig } from '../netlify/functions/checkout-estimate.mjs';

const context = { site: { id: '275b4115-16bf-42fb-9b36-6bce9bb93608' }, deploy: { context: 'production', published: true } };
const base = 'https://afterhoursagenda.com';
const values = {
  NETLIFY_DB_URL: 'postgresql://local:local@127.0.0.1:9/isolated_test',
  AHA_FULFILLMENT_ENABLED: 'true', AHA_FULFILLMENT_START_AT: '2026-10-15T00:00:00Z',
  AHA_SQUARE_MERCHANT_ID: 'local-merchant', AHA_SQUARE_LOCATION_ID: 'local-location',
  AHA_SQUARE_WEBHOOK_SIGNATURE_KEY: 'local-signature-key', AHA_FULFILLMENT_ADMIN_TOKEN: 'local-admin-token',
  AHA_APLIIQ_SHARED_SECRET: 'local-apliiq-secret',
};

function isolate(t) {
  const previous = { netlify: globalThis.Netlify, database: process.env.NETLIFY_DB_URL, fetch: globalThis.fetch };
  globalThis.Netlify = { env: { get: (key) => values[key] } };
  process.env.NETLIFY_DB_URL = values.NETLIFY_DB_URL;
  globalThis.fetch = async () => { throw new Error('Network is forbidden in entrypoint authorization tests'); };
  t.after(() => {
    globalThis.Netlify = previous.netlify;
    if (previous.database === undefined) delete process.env.NETLIFY_DB_URL;
    else process.env.NETLIFY_DB_URL = previous.database;
    globalThis.fetch = previous.fetch;
  });
}

test('API entrypoints reject other sites, preview deploys and noncanonical hosts before accessing providers', async (t) => {
  isolate(t);
  for (const [handler, path, method] of [[squareWebhook, '/api/webhooks/square', 'POST'], [apliiqWebhook, '/api/webhooks/apliiq/fulfillment', 'POST'], [health, '/api/fulfillment/health', 'GET']]) {
    for (const [host, candidate] of [
      [base, { ...context, site: { id: 'another-site' } }],
      [base, { ...context, deploy: { context: 'deploy-preview' } }],
      ['https://a-preview.netlify.app', context],
    ]) assert.equal((await handler(new Request(host + path, { method }), candidate)).status, 404);
  }
});

test('unsigned webhooks and unauthenticated health cannot read or change orders', async (t) => {
  isolate(t);
  assert.equal((await squareWebhook(new Request(base + '/api/webhooks/square', { method: 'POST', body: '{}' }), context)).status, 403);
  assert.equal((await apliiqWebhook(new Request(base + '/api/webhooks/apliiq/fulfillment', { method: 'POST', body: '{}' }), context)).status, 403);
  assert.equal((await health(new Request(base + '/api/fulfillment/health'), context)).status, 401);
});

test('webhooks bound unsigned bodies before database, catalog, or provider setup', async (t) => {
  isolate(t);
  const body = 'x'.repeat(131_073);
  for (const [handler, path] of [[squareWebhook, '/api/webhooks/square'], [apliiqWebhook, '/api/webhooks/apliiq/fulfillment']]) {
    const response = await handler(new Request(base + path, { method: 'POST', body, headers: { 'content-length': String(body.length) } }), context);
    assert.equal(response.status, 413);
  }
});

test('checkout quote and estimate export Netlify-compatible per-client bounds', () => {
  for (const config of [quoteConfig, estimateConfig]) {
    assert.deepEqual(config.rateLimit, { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] });
    assert.deepEqual(config.method, ['POST']);
  }
});

test('valid signatures do not bypass the merchant or supported-event checks', async (t) => {
  isolate(t);
  const url = base + '/api/webhooks/square';
  const signed = (event) => {
    const body = JSON.stringify(event);
    const signature = createHmac('sha256', values.AHA_SQUARE_WEBHOOK_SIGNATURE_KEY).update(url + body).digest('base64');
    return new Request(url, { method: 'POST', body, headers: { 'x-square-hmacsha256-signature': signature } });
  };
  assert.equal((await squareWebhook(signed({ type: 'payment.updated', merchant_id: 'wrong-merchant' }), context)).status, 403);
  const ignored = await squareWebhook(signed({ type: 'local.verification', merchant_id: 'local-merchant' }), context);
  assert.equal(ignored.status, 202);
  assert.equal((await ignored.json()).ignored, true);
});
