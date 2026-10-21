import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedText } from '../server/http/body.mjs';
import { jsonBody } from '../server/checkout/http.mjs';
import { webhookBody } from '../server/fulfillment/http.mjs';

const request = (body, headers = {}) => new Request('https://example.test/', { method: 'POST', body, headers, duplex: 'half' });

test('request limits count bytes across chunks and cancel oversized streams without a length header', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('é')); controller.enqueue(new TextEncoder().encode('é')); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(boundedText(request(stream), 3), /request_size/);
  assert.equal(cancelled, true);
  assert.equal(await boundedText(request('é'), 2), 'é');
});

test('stalled streams time out, cancel, and never produce partial input', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(boundedText(request(stream), 16, 15), /request_timeout/);
  assert.equal(cancelled, true);
});

test('checkout and webhook boundaries reject actual oversized content before parsing it', async () => {
  await assert.rejects(jsonBody(request(JSON.stringify({ text: 'x'.repeat(16_384) }))), error => error.code === 'invalid_request');
  assert.equal(await webhookBody(request('x'.repeat(131_073))), null);
  const raw = '{"type":"event","unicode":"é"}';
  assert.equal(await webhookBody(request(raw)), raw, 'HMAC input must be unchanged');
});
