import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrief, validateBrief } from '../src/scripts/brief.ts';
test('blank and malformed fields get precise errors', () => {
  assert.deepEqual(Object.keys(validateBrief({})), [
    'name',
    'email',
    'message',
  ]);
  assert.ok(
    validateBrief({
      name: 'Alex',
      email: 'broken',
      message: 'Fix our booking.',
    }).email,
  );
});
test('a valid brief prepares an encoded LFNYC email without sending', () => {
  const values = {
    name: 'Alex & Sam',
    business: 'A / B',
    email: 'owner@example.com',
    message: 'Help with booking & invoices?',
    service: 'websites',
  };
  assert.deepEqual(validateBrief(values), {});
  const brief = createBrief(values);
  const url = new URL(brief.url);
  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, 'hello@littlefightnyc.com');
  assert.equal(url.searchParams.get('body'), brief.body);
  assert.match(brief.body, /Alex & Sam/);
  assert.match(brief.body, /Custom website/);
});
test('unknown service and missing optional business stay honest', () => {
  const brief = createBrief({
    name: 'Alex',
    email: 'owner@example.com',
    message: 'Help with our website.',
    service: 'javascript:alert(1)',
  });
  assert.match(brief.body, /Free second opinion/);
  assert.match(brief.body, /Business: Not provided/);
  assert.ok(!brief.url.includes('javascript:'));
});
test('long inputs stay bounded and data never becomes HTML', () => {
  const brief = createBrief({
    name: '<script>alert(1)</script>',
    message: 'x'.repeat(10000),
    email: 'owner@example.com',
  });
  assert.ok(brief.body.length < 2300);
  assert.ok(!brief.url.includes('<script>'));
});
