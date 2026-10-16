-- Owner reports: one row per daily health check and weekly digest. The key
-- (health:<date> or digest:<date>) makes each scheduled run send at most once.
CREATE TABLE aha_owner_reports (
  report_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('daily_health', 'weekly_digest')),
  ok boolean NOT NULL,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  emailed_at timestamptz,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_owner_reports_kind_created_idx ON aha_owner_reports (kind, created_at DESC);
