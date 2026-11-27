import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';
import { AHA_SITE_ID } from '../../server/fulfillment/runtime.mjs';
import { runTracking } from '../../server/orders/tracking.mjs';
import { trackWorker } from '../../server/operations/worker.mjs';

const idleKey = 'shipment-tracking-idle';
const idleMs = 25 * 60_000;

export async function runShipmentWhenDue({ getDb, env, store, clock = Date.now, track = runTracking }) {
  const startedAt = clock();
  try {
    const checkedAt = await store.get(idleKey, { type: 'json' });
    if (Number.isFinite(checkedAt) && checkedAt <= startedAt && startedAt - checkedAt < idleMs) return;
  } catch { /* If the checkpoint is unavailable, run against the durable queue. */ }

  const db = getDb();
  await trackWorker(db, 'shipment-tracking', async () => {
    const result = await track({ db, env });
    if (result.processed > 0) return result;
    // Even when the provider is disabled, preserve the regular housekeeping
    // for delivered orders with a milestone still to recover.
    const [work] = await db.sql`SELECT EXISTS (
      SELECT 1 FROM aha_shipment_tracking WHERE delivered_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM aha_fulfillment_orders f WHERE f.state = 'shipped'
        AND EXISTS (SELECT 1 FROM aha_shipment_tracking t
          WHERE t.square_order_id = f.square_order_id AND t.delivered_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM aha_order_milestones m
          WHERE m.square_order_id = f.square_order_id AND m.stage = 'delivered')
    ) AS pending`;
    // Only skip after a successful empty sweep. A newly received label is
    // picked up at the next full sweep, at most one scheduled tick later.
    if (work?.pending === false) {
      try { await store.setJSON(idleKey, startedAt); }
      catch { /* A missed checkpoint only costs an extra check. */ }
    }
    return result;
  }, env);
}

export default async function shipmentTracking(_request,context) {
  if(context?.site?.id!==AHA_SITE_ID || context?.deploy?.context!=='production') return;
  let store;
  try {
    store = getStore({
      name: 'commerce-scheduling-v1',
      consistency: 'strong',
      fetch: async (input, init) => {
        try {
          const timeout = AbortSignal.timeout(1_000);
          return await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
        } catch {
          return new Response(null, { status: 400 });
        }
      },
    });
  } catch { /* A misconfigured optional store cannot stop reconciliation. */ }
  await runShipmentWhenDue({ getDb: getDatabase, env: Netlify.env, store });
}
export const config={schedule:'7,22,37,52 * * * *'};
