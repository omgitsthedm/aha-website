-- After Hours Agenda — initial operational schema (Netlify DB / Neon / Postgres).
-- Governing doc: docs/MASTER-BUILD-INSTRUCTION.md §14.
-- Rules: store external IDs; snapshot product/order data at purchase time; keep payment
-- and fulfillment status SEPARATE; store raw webhook payloads; dedupe every webhook;
-- no raw card data; minimize PII; never store Square/Printful tokens.

-- ── Catalog (mirror of the internal manifest for querying/joins) ─────────────
CREATE TABLE IF NOT EXISTS products (
  id                text PRIMARY KEY,            -- aha_product_id
  slug              text UNIQUE NOT NULL,
  title             text NOT NULL,
  product_type      text NOT NULL,
  status            text NOT NULL,
  retail_price      integer NOT NULL,            -- minor units (cents)
  currency          text NOT NULL DEFAULT 'USD',
  drop_id           text,
  data_json         jsonb NOT NULL DEFAULT '{}', -- full AhaProduct snapshot
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id                text PRIMARY KEY,            -- aha_variant_id
  product_id        text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku               text UNIQUE NOT NULL,
  size              text NOT NULL,
  color             text,
  retail_price      integer NOT NULL,
  currency          text NOT NULL DEFAULT 'USD',
  status            text NOT NULL,
  square_catalog_object_id  text,
  square_variation_id       text,
  square_location_id        text,
  printful_catalog_product_id integer,
  printful_catalog_variant_id integer,
  printful_placements_json    jsonb,
  cost_estimate     integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS collections ( id text PRIMARY KEY, slug text UNIQUE NOT NULL, title text NOT NULL, data_json jsonb NOT NULL DEFAULT '{}' );
CREATE TABLE IF NOT EXISTS drops ( id text PRIMARY KEY, slug text UNIQUE NOT NULL, title text NOT NULL, status text NOT NULL, launch_date timestamptz, data_json jsonb NOT NULL DEFAULT '{}' );
CREATE TABLE IF NOT EXISTS size_guides ( id text PRIMARY KEY, product_type text NOT NULL, data_json jsonb NOT NULL DEFAULT '{}' );
CREATE TABLE IF NOT EXISTS lookbook_entries ( id text PRIMARY KEY, slug text UNIQUE NOT NULL, data_json jsonb NOT NULL DEFAULT '{}' );

-- ── Mapping tables (glue) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS square_catalog_map (
  aha_variant_id text PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  square_catalog_object_id text, square_variation_id text, square_location_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS printful_v2_variant_map (
  aha_variant_id text PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  printful_catalog_product_id integer, printful_catalog_variant_id integer,
  placements_json jsonb, region_availability_json jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS printful_v2_catalog_snapshots ( id bigserial PRIMARY KEY, taken_at timestamptz NOT NULL DEFAULT now(), payload_json jsonb NOT NULL );

-- ── Customers / carts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            bigserial PRIMARY KEY,
  email         text UNIQUE,
  phone         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS carts ( id text PRIMARY KEY, customer_id bigint REFERENCES customers(id), status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS cart_items ( id bigserial PRIMARY KEY, cart_id text NOT NULL REFERENCES carts(id) ON DELETE CASCADE, aha_variant_id text NOT NULL, quantity integer NOT NULL CHECK (quantity > 0), unit_price integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now() );

-- ── Orders (payment status and fulfillment status kept SEPARATE) ─────────────
CREATE TABLE IF NOT EXISTS orders (
  id                    bigserial PRIMARY KEY,
  external_order_number text UNIQUE NOT NULL,
  customer_id           bigint REFERENCES customers(id),
  email                 text NOT NULL,
  phone                 text,
  shipping_name         text,
  shipping_address_json jsonb,
  billing_address_json  jsonb,
  currency              text NOT NULL DEFAULT 'USD',
  subtotal_amount       integer NOT NULL DEFAULT 0,
  shipping_amount       integer NOT NULL DEFAULT 0,
  tax_amount            integer NOT NULL DEFAULT 0,
  discount_amount       integer NOT NULL DEFAULT 0,
  total_amount          integer NOT NULL DEFAULT 0,
  payment_status        text NOT NULL DEFAULT 'created',
  fulfillment_status    text NOT NULL DEFAULT 'not_started',
  customer_status       text NOT NULL DEFAULT 'Order received',
  square_payment_id     text,
  square_order_id       text,
  printful_order_id     text,
  risk_status           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);

CREATE TABLE IF NOT EXISTS order_items (
  id                bigserial PRIMARY KEY,
  order_id          bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  aha_product_id    text NOT NULL,
  aha_variant_id    text NOT NULL,
  sku               text NOT NULL,
  title_snapshot    text NOT NULL,
  size_snapshot     text,
  color_snapshot    text,
  quantity          integer NOT NULL CHECK (quantity > 0),
  unit_price        integer NOT NULL,
  line_total        integer NOT NULL,
  square_variation_id text,
  printful_catalog_variant_id integer,
  printful_placement_snapshot_json jsonb,
  printful_file_snapshot_json jsonb,
  fulfillment_status text NOT NULL DEFAULT 'not_started',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments ( id bigserial PRIMARY KEY, order_id bigint REFERENCES orders(id), square_payment_id text UNIQUE, status text NOT NULL, amount integer NOT NULL, currency text NOT NULL DEFAULT 'USD', idempotency_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS fulfillments ( id bigserial PRIMARY KEY, order_id bigint REFERENCES orders(id), printful_order_id text, status text NOT NULL DEFAULT 'not_started', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS shipments ( id bigserial PRIMARY KEY, order_id bigint REFERENCES orders(id), printful_shipment_id text, carrier text, tracking_number text, tracking_url text, status text, shipped_at timestamptz, delivered_at timestamptz, data_json jsonb );

-- ── Growth / retention ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restock_requests ( id bigserial PRIMARY KEY, aha_variant_id text NOT NULL, email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), notified_at timestamptz, UNIQUE (aha_variant_id, email) );
CREATE TABLE IF NOT EXISTS email_subscribers ( id bigserial PRIMARY KEY, email text UNIQUE NOT NULL, consent boolean NOT NULL DEFAULT true, source text, created_at timestamptz NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS sms_subscribers ( id bigserial PRIMARY KEY, phone text UNIQUE NOT NULL, consent boolean NOT NULL DEFAULT true, source text, created_at timestamptz NOT NULL DEFAULT now() );

-- ── Webhooks / audit / ops ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id                bigserial PRIMARY KEY,
  provider          text NOT NULL,               -- 'square' | 'printful'
  event_id          text,
  event_type        text,
  signature         text,
  signature_valid   boolean NOT NULL DEFAULT false,
  raw_payload       jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'received',
  dedupe_key        text NOT NULL,
  processed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, dedupe_key)                   -- idempotency: never process twice
);
CREATE TABLE IF NOT EXISTS audit_log ( id bigserial PRIMARY KEY, entity_type text NOT NULL, entity_id text NOT NULL, action text NOT NULL, old_status text, new_status text, source text, actor text, metadata_json jsonb, created_at timestamptz NOT NULL DEFAULT now() );
CREATE TABLE IF NOT EXISTS sync_runs ( id bigserial PRIMARY KEY, kind text NOT NULL, status text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, detail_json jsonb );
CREATE TABLE IF NOT EXISTS inventory_snapshots ( id bigserial PRIMARY KEY, taken_at timestamptz NOT NULL DEFAULT now(), payload_json jsonb NOT NULL );
CREATE TABLE IF NOT EXISTS price_snapshots ( id bigserial PRIMARY KEY, taken_at timestamptz NOT NULL DEFAULT now(), payload_json jsonb NOT NULL );
CREATE TABLE IF NOT EXISTS product_feed_snapshots ( id bigserial PRIMARY KEY, taken_at timestamptz NOT NULL DEFAULT now(), payload_json jsonb NOT NULL );
