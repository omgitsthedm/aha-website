-- Future purchases only. This stores anonymous attribution and a durable
-- provider-scoped delivery state; no address, name, email, card data or IP.
ALTER TABLE aha_checkout_sessions
  ADD COLUMN marketing_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE aha_marketing_purchase_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('google', 'meta')),
  square_order_id text NOT NULL,
  checkout_id text NOT NULL REFERENCES aha_checkout_sessions(checkout_id) ON DELETE CASCADE,
  payload_json jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'attention', 'disabled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT aha_marketing_purchase_outbox_provider_order_key UNIQUE (provider, square_order_id)
);

CREATE INDEX aha_marketing_purchase_outbox_dispatch_idx
  ON aha_marketing_purchase_outbox (state, next_attempt_at, created_at)
  WHERE state = 'pending';
