-- Separate from the preserved 2026 summer storefront tables. No historical
-- orders are changed or imported; routing starts at the configured activation.
CREATE TABLE aha_fulfillment_orders (
  square_order_id text PRIMARY KEY,
  square_payment_id text UNIQUE,
  square_fulfillment_uid text,
  payment_created_at timestamptz,
  state text NOT NULL,
  claimed_at timestamptz,
  apliiq_order_id text UNIQUE,
  provider_status text,
  submitted_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  apliiq_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_sha256 text,
  shipped_line_quantities jsonb NOT NULL DEFAULT '{}'::jsonb,
  tracking jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_fulfillment_orders_state_updated_idx
  ON aha_fulfillment_orders (state, updated_at);

CREATE TABLE aha_fulfillment_events (
  provider_event_id text PRIMARY KEY,
  square_order_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  processed_at timestamptz
);

CREATE INDEX aha_fulfillment_events_order_idx
  ON aha_fulfillment_events (square_order_id);

CREATE TABLE aha_fulfillment_square_events (
  square_event_id text PRIMARY KEY,
  square_payment_id text NOT NULL,
  event_created_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_fulfillment_square_events_pending_idx
  ON aha_fulfillment_square_events (updated_at, received_at)
  WHERE processed_at IS NULL;
