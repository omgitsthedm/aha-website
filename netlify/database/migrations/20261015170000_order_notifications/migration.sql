-- Active-store transactional mail only. Existing historical orders are not imported.
ALTER TABLE aha_fulfillment_orders
  ADD COLUMN IF NOT EXISTS customer_email text;

CREATE TABLE aha_order_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('order_confirmed', 'order_shipped')),
  recipient text NOT NULL,
  payload_json jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'attention')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX aha_order_notifications_dispatch_idx
  ON aha_order_notifications (state, next_attempt_at, created_at)
  WHERE state = 'pending';
