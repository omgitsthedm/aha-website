-- Product drafts waiting for owner approval. Apliiq's "Add to Store" button
-- and the admin create rows here; nothing in this table is sellable until the
-- catalog engine publishes it and the ledger, Square and the site agree.
CREATE TABLE aha_product_drafts (
  id text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('apliiq-add-to-store', 'manual', 'engine')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'published', 'failed')),
  payload_json jsonb NOT NULL,
  design_slug text,
  apliiq_design_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  error text
);

CREATE INDEX aha_product_drafts_status_idx
  ON aha_product_drafts (status, updated_at DESC);

CREATE UNIQUE INDEX aha_product_drafts_open_design_idx
  ON aha_product_drafts (apliiq_design_id)
  WHERE apliiq_design_id IS NOT NULL AND status IN ('draft', 'approved');
