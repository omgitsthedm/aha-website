import assert from 'node:assert/strict';
import test from 'node:test';
import { config as commerce } from '../netlify/functions/commerce-monitor.mjs';
import { config as fulfillment } from '../netlify/functions/fulfillment-reconcile.mjs';
import { config as marketing } from '../netlify/functions/marketing-dispatch.mjs';
import { config as notifications } from '../netlify/functions/notification-dispatch.mjs';
import { config as operations } from '../netlify/functions/operations-health.mjs';
import { config as shipments, runShipmentWhenDue } from '../netlify/functions/shipment-tracking.mjs';
import { config as recovery } from '../netlify/functions/square-recovery.mjs';
import { config as digest } from '../netlify/functions/weekly-digest.mjs';

test('all database workers use the same quarter-hour database window', () => {
  const quarterHours = '7,22,37,52';
  for (const job of [fulfillment, notifications, shipments, recovery]) {
    assert.equal(job.schedule, quarterHours + ' * * * *');
  }
  assert.equal(commerce.schedule, '8,23,38,53 * * * *');
  for (const job of [marketing, operations, digest]) {
    assert.ok(quarterHours.split(',').includes(job.schedule.split(' ')[0]));
  }
});

test('shipment tracking skips one empty tick and then checks the durable queue again', async () => {
  const flight = shipmentHarness();
  await runShipmentWhenDue(flight.options);
  assert.equal(flight.tracked, 1);
  flight.advance(15);
  await runShipmentWhenDue(flight.options);
  assert.equal(flight.opened, 1);
  flight.advance(15);
  await runShipmentWhenDue(flight.options);
  assert.equal(flight.tracked, 2);
});

test('pending shipments and unavailable checkpoints preserve reconciliation', async () => {
  const flight = shipmentHarness();
  flight.pending = true;
  await runShipmentWhenDue(flight.options);
  flight.advance(15);
  await runShipmentWhenDue(flight.options);
  assert.equal(flight.tracked, 2);
  flight.pending = false;
  flight.options.store.get = async () => { throw new Error('store unavailable'); };
  flight.options.store.setJSON = async () => { throw new Error('store unavailable'); };
  await runShipmentWhenDue(flight.options);
  assert.equal(flight.tracked, 3);
});

function shipmentHarness() {
  let checkedAt;
  let now = Date.parse('2026-11-27T08:07:00Z');
  const testContext = { pending: false, opened: 0, tracked: 0 };
  testContext.advance = (minutes) => { now += minutes * 60_000; };
  testContext.options = {
    env: { get: () => undefined },
    clock: () => now,
    store: {
      get: async () => checkedAt,
      setJSON: async (_key, value) => { checkedAt = value; },
    },
    getDb: () => {
      testContext.opened += 1;
      return { sql: async (parts) => parts[0].startsWith('SELECT') ? [{ pending: testContext.pending }] : [] };
    },
    track: async () => {
      testContext.tracked += 1;
      return { processed: 0 };
    },
  };
  return testContext;
}
