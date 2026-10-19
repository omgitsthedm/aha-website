-- Two customer emails the owner approved on October 19, 2026: one reminder
-- about a bag left at checkout, and one review request after an order ships.
-- Both carry the store's postal address and a one-click unsubscribe. An
-- unsubscribed address is kept only as a SHA-256 hash and gets neither again.
-- Each program only covers checkouts and shipments after it started, so
-- nobody hears about anything from before this migration.
DO $$
DECLARE constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'aha_order_notifications'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE aha_order_notifications DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

ALTER TABLE aha_order_notifications
  ADD CONSTRAINT aha_order_notifications_kind_check
  CHECK (kind IN ('order_confirmed', 'order_shipped', 'cart_reminder', 'review_request'));

CREATE INDEX aha_order_notifications_recipient_idx
  ON aha_order_notifications (recipient, kind, created_at);

CREATE TABLE aha_email_suppressions (
  email_sha256 text PRIMARY KEY,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aha_email_programs (
  name text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO aha_email_programs (name) VALUES ('cart_reminder'), ('review_request');
