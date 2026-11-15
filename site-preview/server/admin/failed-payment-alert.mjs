// A reviewed failed payment remains held. The acknowledgment applies only
// while every local record is unchanged and no later Square event arrived.
export async function reviewedFailedPaymentIds(db) {
  const rows = await db.sql`
    SELECT f.square_order_id
    FROM aha_fulfillment_orders f
    JOIN aha_checkout_sessions s ON s.square_order_id=f.square_order_id
    JOIN aha_admin_audit a ON a.target=f.square_order_id AND a.action='order.failed_payment_reviewed'
      AND a.detail_json->>'paymentId'=f.square_payment_id
    WHERE f.state='held' AND f.last_error_code='payment_terminal' AND f.apliiq_order_id IS NULL AND f.provider_status IS NULL
      AND f.customer_change_hold=false
      AND f.attempt_count=0 AND f.claimed_at IS NULL AND f.square_fulfillment_uid IS NULL
      AND f.payment_created_at IS NULL AND f.payload_sha256 IS NULL
      AND f.submitted_items='[]'::jsonb AND f.apliiq_payload='{}'::jsonb
      AND f.tracking='[]'::jsonb AND f.shipped_line_quantities='{}'::jsonb
      AND s.state='failed' AND (s.square_payment_id IS NULL OR s.square_payment_id=f.square_payment_id)
      AND f.updated_at=(a.detail_json->>'fulfillmentUpdated')::timestamptz
      AND s.updated_at=(a.detail_json->>'checkoutUpdated')::timestamptz
      AND NOT EXISTS (SELECT 1 FROM aha_fulfillment_events e WHERE e.square_order_id=f.square_order_id)
      AND NOT EXISTS (SELECT 1 FROM aha_support_cases c WHERE c.state<>'resolved' AND c.order_reference IN
                      (f.square_order_id, s.order_payload_json->>'reference_id', f.apliiq_payload->>'order_number'))
      AND NOT EXISTS (SELECT 1 FROM aha_fulfillment_square_events e WHERE e.square_payment_id=f.square_payment_id
                      AND (e.processed_at IS NULL OR e.received_at>a.created_at))
      AND NOT EXISTS (SELECT 1 FROM aha_fulfillment_square_events e WHERE e.processed_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM aha_commerce_events e WHERE e.processed_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM aha_order_financials m WHERE m.square_order_id=f.square_order_id
                      AND (m.payment_state<>'FAILED' OR m.dispute_state='open' OR m.cancellation_state<>'none' OR m.refund_failed
                           OR COALESCE(m.refund_pending_cents,0)>0 OR COALESCE(m.refunded_cents,0)>0 OR COALESCE(m.refund_state,'none')<>'none'))
  `;
  return new Set(rows.map(row => row.square_order_id));
}
