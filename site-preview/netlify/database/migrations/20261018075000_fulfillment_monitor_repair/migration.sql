-- Internal monitoring repair only. No provider requests, submission claims,
-- shipment changes, notifications or checkout records are created.
-- The candidate set was checked against Square and Apliiq before release.
-- The time boundary prevents this repair from sweeping in future orders.
WITH repaired AS (
  UPDATE aha_fulfillment_orders o
  SET state = 'ignored', last_error_code = NULL,
      provider_status = 'non_shipping_receipt', updated_at = now()
  WHERE o.state = 'held'
    AND o.last_error_code = 'unsupported_fulfillment_shape'
    AND o.updated_at < '2026-10-18T07:43:00Z'::timestamptz
    AND o.apliiq_order_id IS NULL AND o.square_fulfillment_uid IS NULL
    AND o.square_payment_id IS NOT NULL AND o.payment_created_at IS NULL
    AND o.attempt_count = 0 AND o.claimed_at IS NULL
    AND o.submitted_items = '[]'::jsonb AND o.apliiq_payload = '{}'::jsonb
    AND o.tracking = '[]'::jsonb AND o.shipped_line_quantities = '{}'::jsonb
    AND NOT EXISTS (SELECT 1 FROM aha_checkout_sessions s WHERE s.square_order_id = o.square_order_id)
  RETURNING o.square_order_id
)
INSERT INTO aha_admin_audit (action, target, detail_json)
SELECT 'fulfillment.monitor_repaired', square_order_id,
  '{"migration":"20261018075000_fulfillment_monitor_repair","fromState":"held","fromError":"unsupported_fulfillment_shape","toState":"ignored","reason":"verified_non_shipping_receipt","providerWrites":false}'::jsonb
FROM repaired;

-- Re-enable GET-only reconciliation of existing provider associations.
-- This state cannot be claimed for submission (only 'queued' can).
WITH repaired AS (
  UPDATE aha_fulfillment_orders o
  SET state = 'submitted_reconciled', last_error_code = NULL,
      provider_status = 'reconciliation_pending', updated_at = now()
  WHERE o.state = 'attention' AND o.last_error_code = 'provider_join_mismatch'
    AND o.provider_status = 'id_mismatch'
    AND o.updated_at < '2026-10-18T07:43:00Z'::timestamptz
    AND o.apliiq_order_id IS NOT NULL AND o.square_fulfillment_uid IS NOT NULL
    AND o.attempt_count = 1
    AND o.apliiq_payload->>'id' = o.square_order_id
    AND jsonb_array_length(o.submitted_items) > 0
    AND o.tracking = '[]'::jsonb AND o.shipped_line_quantities = '{}'::jsonb
  RETURNING o.square_order_id, o.apliiq_order_id
)
INSERT INTO aha_admin_audit (action, target, detail_json)
SELECT 'fulfillment.monitor_repaired', square_order_id,
  jsonb_build_object('migration', '20261018075000_fulfillment_monitor_repair',
    'fromState', 'attention', 'fromError', 'provider_join_mismatch',
    'toState', 'submitted_reconciled', 'providerOrderId', apliiq_order_id, 'providerWrites', false)
FROM repaired;
