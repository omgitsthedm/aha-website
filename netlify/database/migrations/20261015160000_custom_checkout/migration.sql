-- Custom checkout sessions are deliberately separate from legacy storefront
-- tables and fulfillment records. They contain an immutable server-priced
-- checkout snapshot, never a card or Web Payments source token.
CREATE TABLE aha_checkout_sessions (
  checkout_id text PRIMARY KEY,
  token_sha256 text NOT NULL,
  state text NOT NULL CHECK (state IN ('quoted', 'processing', 'completed', 'failed', 'unknown')),
  currency text NOT NULL DEFAULT 'USD',
  cart_json jsonb NOT NULL,
  shipping_address_json jsonb NOT NULL,
  order_payload_json jsonb NOT NULL,
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents integer NOT NULL CHECK (shipping_cents >= 0),
  tax_cents integer NOT NULL CHECK (tax_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  tax_label text,
  square_order_id text UNIQUE,
  square_payment_id text UNIQUE,
  square_receipt_url text,
  order_idempotency_key text NOT NULL UNIQUE,
  payment_idempotency_key text,
  processing_lease_expires_at timestamptz,
  expires_at timestamptz NOT NULL,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_checkout_sessions_state_updated_idx
  ON aha_checkout_sessions (state, updated_at);
