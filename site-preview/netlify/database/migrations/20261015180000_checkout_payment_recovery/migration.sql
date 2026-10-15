-- Fence payment recovery from an expired server invocation. This marker is
-- written before the only outbound CreatePayment call and never stores a token.
ALTER TABLE aha_checkout_sessions
  ADD COLUMN payment_submission_started_at timestamptz;

CREATE INDEX aha_checkout_sessions_recovery_idx
  ON aha_checkout_sessions (state, processing_lease_expires_at, payment_submission_started_at);
