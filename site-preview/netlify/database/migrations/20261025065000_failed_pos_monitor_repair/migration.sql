-- Owner-authorized, one-record monitoring disposition. Provider/payment IDs
-- remain private: the exact inspected pair is selected by SHA-256 fingerprints.
-- No provider request, checkout, fulfillment attempt or notification is created.
DO $repair$
DECLARE
  order_fingerprint CONSTANT text := 'f7f7682b2c6f6870dbfe83645ae5f9fcd70f0e2d02908597f6448d8784680210';
  payment_fingerprint CONSTANT text := 'aa2bbb3ad70e8ecd2ec745f8ce3f7ec1324dcd8b8031bcd42de21202de69a3d8';
  migration_name CONSTANT text := '20261025065000_failed_pos_monitor_repair';
  target_row aha_fulfillment_orders%ROWTYPE;
BEGIN
  SELECT * INTO target_row
  FROM aha_fulfillment_orders
  WHERE encode(sha256(convert_to(square_order_id, 'UTF8')), 'hex') = order_fingerprint
  FOR UPDATE;

  -- Fresh environments may not contain the historical record.
  IF NOT FOUND THEN RETURN; END IF;

  IF (
    encode(sha256(convert_to(target_row.square_payment_id, 'UTF8')), 'hex') = payment_fingerprint
    AND target_row.apliiq_order_id IS NULL
    AND target_row.square_fulfillment_uid IS NULL
    AND target_row.payment_created_at IS NULL
    AND target_row.attempt_count = 0
    AND target_row.claimed_at IS NULL
    AND target_row.submitted_items = '[]'::jsonb
    AND target_row.apliiq_payload = '{}'::jsonb
    AND target_row.payload_sha256 IS NULL
    AND target_row.tracking = '[]'::jsonb
    AND target_row.shipped_line_quantities = '{}'::jsonb
    AND NOT EXISTS (
      SELECT 1 FROM aha_checkout_sessions s
      WHERE s.square_order_id = target_row.square_order_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM aha_fulfillment_events e
      WHERE e.square_order_id = target_row.square_order_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM aha_fulfillment_square_events e
      WHERE e.square_payment_id = target_row.square_payment_id
        AND e.processed_at IS NULL
    )
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'Failed POS monitor repair: target is not eligible; nothing changed';
  END IF;

  -- A replay is a no-op only when this migration already audited the repair.
  IF target_row.state = 'ignored'
    AND target_row.last_error_code IS NULL
    AND target_row.provider_status = 'non_shipping_receipt'
    AND EXISTS (
      SELECT 1 FROM aha_admin_audit a
      WHERE a.target = target_row.square_order_id
        AND a.action = 'fulfillment.monitor_repaired'
        AND a.detail_json->>'migration' = migration_name
    )
  THEN RETURN; END IF;

  IF (
    target_row.state = 'held'
    AND target_row.last_error_code = 'payment_terminal'
    AND target_row.provider_status IS NULL
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'Failed POS monitor repair: target is not eligible; nothing changed';
  END IF;

  UPDATE aha_fulfillment_orders
  SET state = 'ignored', last_error_code = NULL,
      provider_status = 'non_shipping_receipt', updated_at = now()
  WHERE square_order_id = target_row.square_order_id;

  -- The DO statement is atomic: a failed audit insert rolls back the update.
  INSERT INTO aha_admin_audit (action, target, detail_json)
  VALUES (
    'fulfillment.monitor_repaired',
    target_row.square_order_id,
    jsonb_build_object(
      'migration', migration_name,
      'fromState', target_row.state,
      'fromError', target_row.last_error_code,
      'fromProviderStatus', target_row.provider_status,
      'toState', 'ignored',
      'reason', 'verified_failed_non_shipping_receipt',
      'authorization', 'explicit_owner_request',
      'evidence', jsonb_build_object(
        'squareOrderState', 'CANCELED',
        'squarePaymentStatus', 'FAILED',
        'paymentError', 'GENERIC_DECLINE',
        'storefrontCheckout', false,
        'providerOrder', false,
        'submissionAttempts', 0
      ),
      'providerWrites', false,
      'notificationWrites', false
    )
  );
END
$repair$;
