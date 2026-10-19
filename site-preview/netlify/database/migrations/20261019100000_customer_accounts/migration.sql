-- Customer accounts, saved pieces and reviews. Accounts sign in with passkeys
-- only: no passwords, names or email addresses are stored. An account can hold
-- the pieces its owner saves and the orders they add from their private order
-- links. Reviews come from shipped orders and appear on the site only after the
-- owner approves them. Session and challenge tokens are stored only as SHA-256
-- hashes. Deleting an account deletes its passkeys, sessions, saved pieces and
-- order links; reviews belong to orders and stay.
CREATE TABLE aha_customers (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aha_customer_credentials (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES aha_customers (id) ON DELETE CASCADE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX aha_customer_credentials_customer_idx ON aha_customer_credentials (customer_id);

CREATE TABLE aha_customer_sessions (
  token_sha256 text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES aha_customers (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX aha_customer_sessions_customer_idx ON aha_customer_sessions (customer_id);

CREATE TABLE aha_customer_challenges (
  id_sha256 text PRIMARY KEY,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register', 'login')),
  expires_at timestamptz NOT NULL
);

CREATE INDEX aha_customer_challenges_expiry_idx ON aha_customer_challenges (expires_at);

CREATE TABLE aha_customer_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_customer_attempts_client_idx ON aha_customer_attempts (client_key, attempted_at);

CREATE TABLE aha_customer_saved (
  customer_id text NOT NULL REFERENCES aha_customers (id) ON DELETE CASCADE,
  product_slug text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, product_slug)
);

CREATE TABLE aha_customer_orders (
  square_order_id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES aha_customers (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_customer_orders_customer_idx ON aha_customer_orders (customer_id, linked_at DESC);

CREATE TABLE aha_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  square_order_id text NOT NULL,
  product_slug text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 600),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 40),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  moderated_at timestamptz,
  UNIQUE (square_order_id, product_slug)
);

CREATE INDEX aha_reviews_product_idx ON aha_reviews (product_slug, status, updated_at DESC);
CREATE INDEX aha_reviews_status_idx ON aha_reviews (status, updated_at DESC);
