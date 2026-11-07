import { orderStatusUrl } from './status.mjs';
import { productionDeadline } from './deadlines.mjs';

export const PROGRESS = {
  accepted: { rank: 10, heading: 'Your order is with the maker.', message: 'Your order has been received by our production partner. Your garments and artwork are being prepared.' },
  creating: { rank: 20, heading: 'Your pieces are being made.', message: 'Our production partner has confirmed that your order is in production.' },
  ready: { rank: 30, heading: 'Your pieces are being prepared to ship.', message: 'Production is complete. Your pieces are going through final checks and packing. We will send tracking when they ship.' },
  delayed: { rank: 0, heading: 'An update on your order.', message: 'Your order is taking longer than expected or needs attention before it can move forward. We are reviewing it. Reply to this email if you need help or want to discuss your options.' },
  delivered: { rank: 50, heading: 'Your order has been delivered.', message: 'The carrier reports that all tracked parcels for your order have been delivered. If anything is missing, reply to this email or use your order page to let us know.' },
  delivery_issue: { rank: 0, heading: 'Your shipment needs attention.', message: 'The carrier reported a delivery problem or a return to sender. Check your tracking and contact us through your order page so we can help.' },
};

export function supplierMilestone(record, provider, now = Date.now()) {
  const state = String(provider?.Status ?? '').trim().toLowerCase();
  if (['shipped', 'success'].includes(state) || ['shipped','ready_to_ship','shipped_partial'].includes(record.state)) return null;
  if (['on hold','payment pending','cancelled','canceled','failed'].includes(state)) return 'delayed';
  const raw = provider.ExpectedShipDate ?? provider.ExpectedDate;
  const deadline = raw ? new Date(raw) : new Date(productionDeadline(record.payment_created_at || record.created_at) || NaN);
  if (raw && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) deadline.setUTCHours(23,59,59,999);
  if (Number.isFinite(deadline.getTime()) && deadline.getTime() < now) return 'delayed';
  if (state === 'in production') return 'creating';
  if (state === 'ready to ship') return 'ready';
  if (['new','preparing to release','ready to release'].includes(state)) return 'accepted';
  return null;
}

// The observation and outbox entry commit together. New reads cannot enqueue
// a backwards milestone, and retries cannot duplicate a message.
export async function recordProgress(db, env, orderId, stage, evidence = 'apliiq') {
  const progress = PROGRESS[stage];
  const statusUrl = orderStatusUrl(orderId, env);
  if (!progress || !statusUrl) return;
  return db.sql`WITH candidate AS (
    UPDATE aha_fulfillment_orders f SET customer_progress_rank=greatest(f.customer_progress_rank,${progress.rank})
    WHERE f.square_order_id=${orderId} AND f.state<>'ignored'
      AND COALESCE((SELECT notification_email FROM aha_checkout_sessions WHERE square_order_id=f.square_order_id LIMIT 1),f.customer_email) ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
      AND NOT EXISTS(SELECT 1 FROM aha_order_financials m WHERE m.square_order_id=f.square_order_id
        AND (m.refund_state<>'none' OR m.cancellation_state<>'none' OR m.dispute_state='open'))
      AND (${progress.rank}=0 OR ${progress.rank}>=f.customer_progress_rank)
      AND (${stage} NOT IN ('accepted','creating','ready','delayed') OR f.state NOT IN ('shipped','shipped_partial','ready_to_ship'))
    RETURNING f.*,COALESCE((SELECT notification_email FROM aha_checkout_sessions WHERE square_order_id=f.square_order_id LIMIT 1),f.customer_email) AS recipient
  ), saved AS (
    INSERT INTO aha_order_milestones(square_order_id,stage,rank,evidence)
    SELECT square_order_id,${stage},${progress.rank},${evidence} FROM candidate
    ON CONFLICT(square_order_id,stage) DO NOTHING RETURNING square_order_id
  ) INSERT INTO aha_order_notifications(dedupe_key,kind,recipient,payload_json)
    SELECT c.square_order_id || ':progress:' || ${stage},'order_progress',c.recipient,
      jsonb_build_object('stage',${stage}::text,'orderNumber',COALESCE(c.apliiq_payload->>'order_number',c.square_order_id),'statusUrl',${statusUrl}::text)
    FROM candidate c JOIN saved USING(square_order_id) ON CONFLICT(dedupe_key) DO NOTHING`;
}

export async function observeSupplier(db, env, record, provider) {
  const stage = supplierMilestone(record, provider);
  if (stage) await recordProgress(db, env, record.square_order_id, stage);
}
