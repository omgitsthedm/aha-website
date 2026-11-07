-- Metadata only: no recipients, message bodies, payment tokens or addresses.
CREATE TABLE aha_email_delivery_events (
  event_id text PRIMARY KEY,
  provider_message_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'delivery_delayed', 'bounced', 'failed', 'suppressed', 'complained')),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aha_email_delivery_message_idx ON aha_email_delivery_events (provider_message_id, occurred_at DESC);

CREATE TABLE aha_commerce_workers (
  job text PRIMARY KEY CHECK (job IN ('fulfillment', 'notifications')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz
);
INSERT INTO aha_commerce_workers (job) VALUES ('fulfillment'), ('notifications');

-- Tracking starts with this migration, without misclassifying older mail as lost.
CREATE TABLE aha_commerce_monitor (
  id integer PRIMARY KEY CHECK (id = 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO aha_commerce_monitor (id) VALUES (1);
ALTER TABLE aha_owner_reports DROP CONSTRAINT aha_owner_reports_kind_check;
ALTER TABLE aha_owner_reports ADD CONSTRAINT aha_owner_reports_kind_check
  CHECK (kind IN ('daily_health', 'weekly_digest', 'commerce_health'));
