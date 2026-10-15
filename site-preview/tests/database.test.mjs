import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createNetlifyRepository } from '../server/fulfillment/repository.mjs';
import { createNotificationRepository } from '../server/notifications/repository.mjs';

test('Netlify repository-level discovery receives the same additive migration validated by the app', async () => {
  for (const name of ['20261015045000_yikes_fulfillment', '20261015160000_custom_checkout', '20261015170000_order_notifications']) {
    const app = await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
    const root = await readFile(new URL(`../../netlify/database/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
    assert.equal(root, app);
  }
});

async function isolatedRepository(t) {
  const database = new PGlite();
  t.after(() => database.close());
  await database.exec(await readFile(new URL('../netlify/database/migrations/20261015045000_yikes_fulfillment/migration.sql', import.meta.url), 'utf8'));
  await database.exec(await readFile(new URL('../netlify/database/migrations/20261015170000_order_notifications/migration.sql', import.meta.url), 'utf8'));
  // The production adapter returns rows from the same parameterized SQL.
  const sql = async (strings, ...parameters) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    return (await database.query(query, parameters)).rows;
  };
  return { database, repository: createNetlifyRepository({ sql }), notifications: createNotificationRepository({ sql }) };
}

function snapshot() {
  return {
    squareOrderId: 'local-order-1', squarePaymentId: 'local-payment-1',
    squareFulfillmentUid: 'local-fulfillment-1', paymentCreatedAt: '2026-10-15T05:00:00Z', state: 'queued',
    submittedItems: [{ sku: 'APQ-6208401S7A1', quantity: 1, squareLineUid: 'local-line-1' }],
    apliiqPayload: { id: 'local-order-1', shipping_address: { name: 'Local test recipient' } },
    customerEmail: 'local@example.com', payloadSha256: 'local-test-hash',
  };
}

test('Postgres allows one durable submission claim under concurrent delivery', async (t) => {
  const { repository } = await isolatedRepository(t);
  await Promise.all(Array.from({ length: 12 }, () => repository.insertValidated(snapshot())));
  const results = await Promise.all(Array.from({ length: 12 }, () => repository.claimForSubmission('local-order-1')));
  assert.equal(results.filter(Boolean).length, 1);
  const row = await repository.getOrder('local-order-1');
  assert.equal(row.state, 'submitting');
  assert.equal(row.attempt_count, 1);
  assert.equal(await repository.claimForSubmission('local-order-1'), null);
});

test('Postgres preserves the original supplier payload and line items on repeated validation', async (t) => {
  const { repository } = await isolatedRepository(t);
  const original = snapshot();
  await repository.insertValidated(original);
  await repository.insertValidated({ ...original, apliiqPayload: { id: 'changed' }, submittedItems: [], payloadSha256: 'changed' });
  const row = await repository.getOrder(original.squareOrderId);
  assert.deepEqual(row.apliiq_payload, original.apliiqPayload);
  assert.deepEqual(row.submitted_items, original.submittedItems);
  assert.equal(row.payload_sha256, original.payloadSha256);
});

test('Postgres deduplicates supplier events and stores partial-shipment JSON', async (t) => {
  const { repository } = await isolatedRepository(t);
  await repository.insertValidated(snapshot());
  await Promise.all(Array.from({ length: 8 }, () => repository.ingestProviderEvent({ eventId: 'local-event-1', squareOrderId: 'local-order-1' })));
  const results = await Promise.all(Array.from({ length: 8 }, () => repository.claimProviderEvent('local-event-1')));
  assert.equal(results.filter(Boolean).length, 1);
  await repository.noteProviderEventError('local-event-1');
  assert.ok(await repository.claimProviderEvent('local-event-1'));
  await repository.markProviderEventProcessed('local-event-1');
  assert.equal(await repository.claimProviderEvent('local-event-1'), null);
  await repository.recordShipment({ squareOrderId: 'local-order-1', quantities: { 'APQ-6208401S7A1': 1 }, tracking: { trackingNumber: 'LOCAL-ONLY' }, complete: false });
  const row = await repository.getOrder('local-order-1');
  assert.equal(row.state, 'shipped_partial');
  assert.deepEqual(row.shipped_line_quantities, { 'APQ-6208401S7A1': 1 });
  assert.equal(row.tracking[0].trackingNumber, 'LOCAL-ONLY');
});

test('a Square event survives worker interruption and an expired lease can be reclaimed once', async (t) => {
  const { repository, database } = await isolatedRepository(t);
  await repository.ingestSquareEvent({ eventId: 'local-square-event', paymentId: 'local-payment-1', eventCreatedAt: '2026-10-15T05:00:00Z' });
  const first = await Promise.all(Array.from({ length: 8 }, () => repository.claimSquareEvent('local-square-event')));
  assert.equal(first.filter(Boolean).length, 1);
  assert.equal((await repository.listPendingSquareEvents()).length, 0);
  await database.query("UPDATE aha_fulfillment_square_events SET lease_expires_at = now() - interval '1 second' WHERE square_event_id = $1", ['local-square-event']);
  assert.equal((await repository.listPendingSquareEvents()).length, 1);
  const second = await repository.claimSquareEvent('local-square-event');
  assert.equal(second.attempt_count, 2);
  await repository.markSquareEventProcessed('local-square-event');
  assert.equal(await repository.claimSquareEvent('local-square-event'), null);
  assert.equal((await repository.listPendingSquareEvents()).length, 0);
});


test('Postgres notification outbox accepts one confirmation and lets one worker claim it', async (t) => {
  const { notifications } = await isolatedRepository(t);
  await Promise.all(Array.from({ length: 8 }, () => notifications.enqueue({ dedupeKey: 'local-order-1:order_confirmed', kind: 'order_confirmed', recipient: 'local@example.com', payload: { orderNumber: 'AHA-local' } })));
  const claims = await Promise.all(Array.from({ length: 8 }, () => notifications.claim(1)));
  assert.equal(claims.flat().length, 1);
  const row = claims.flat()[0];
  await notifications.markSent({ id: row.id, providerMessageId: 'provider-local-1' });
  assert.deepEqual(await notifications.claim(1), []);
});


test('Postgres retries a stale mail lease with the same row and escalates the fifth stale attempt', async (t) => {
  const { notifications, database } = await isolatedRepository(t);
  const row = await notifications.enqueue({ dedupeKey: 'local-order-lease:order_confirmed', kind: 'order_confirmed', recipient: 'local@example.com', payload: { orderNumber: 'AHA-lease' } });
  const [first] = await notifications.claim(1);
  assert.equal(first.id, row.id);
  await database.query("UPDATE aha_order_notifications SET lease_expires_at = now() - interval '1 second' WHERE id = $1", [row.id]);
  const [second] = await notifications.claim(1);
  assert.equal(second.id, row.id);
  assert.equal(second.attempt_count, 2);
  await database.query("UPDATE aha_order_notifications SET attempt_count = 5, lease_expires_at = now() - interval '1 second' WHERE id = $1", [row.id]);
  assert.deepEqual(await notifications.claim(1), []);
  const status = await database.query("SELECT state, last_error_code FROM aha_order_notifications WHERE id = $1", [row.id]);
  assert.deepEqual(status.rows[0], { state: 'attention', last_error_code: 'resend_delivery_unknown' });
});

test('Postgres moves only an already-attempted outbox row older than the Resend idempotency window to attention', async (t) => {
  const { notifications, database } = await isolatedRepository(t);
  const row = await notifications.enqueue({ dedupeKey: 'local-order-window:order_confirmed', kind: 'order_confirmed', recipient: 'local@example.com', payload: { orderNumber: 'AHA-window' } });
  await database.query("UPDATE aha_order_notifications SET attempt_count = 1, first_attempt_at = now() - interval '24 hours', next_attempt_at = now() - interval '1 second' WHERE id = $1", [row.id]);
  assert.deepEqual(await notifications.claim(1), []);
  const elapsed = await database.query('SELECT state, last_error_code FROM aha_order_notifications WHERE id = $1', [row.id]);
  assert.deepEqual(elapsed.rows[0], { state: 'attention', last_error_code: 'resend_delivery_unknown' });

  const fresh = await notifications.enqueue({ dedupeKey: 'local-order-fresh:order_confirmed', kind: 'order_confirmed', recipient: 'local@example.com', payload: { orderNumber: 'AHA-fresh' } });
  const [claim] = await notifications.claim(1);
  assert.equal(claim.id, fresh.id);
});
