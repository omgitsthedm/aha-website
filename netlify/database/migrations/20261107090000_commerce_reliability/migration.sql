-- Additive reliability state. No provider mutations or historical email sends.
ALTER TABLE aha_fulfillment_orders
 ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN revalidation_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN provider_expected_at timestamptz,
 ADD COLUMN provider_checked_at timestamptz,
 ADD COLUMN provider_requirements jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE aha_order_financials (
 square_order_id text PRIMARY KEY,
 square_payment_id text NOT NULL,
 payment_state text NOT NULL,
 refund_state text NOT NULL DEFAULT 'none',
 refunded_cents bigint NOT NULL DEFAULT 0,
 refund_pending_cents bigint NOT NULL DEFAULT 0,
 refund_failed boolean NOT NULL DEFAULT false,
 dispute_state text NOT NULL DEFAULT 'none',
 dispute_due_at timestamptz,
 cancellation_state text NOT NULL DEFAULT 'none',
 processing_fee_cents bigint,
 provider_updated_at timestamptz,
 checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aha_commerce_events (
 event_id text PRIMARY KEY,
 kind text NOT NULL,
 resource_id text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 lease_expires_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 attempt_count integer NOT NULL DEFAULT 0,
 last_error_code text
);
CREATE INDEX aha_commerce_events_pending ON aha_commerce_events(next_attempt_at) WHERE processed_at IS NULL;
CREATE TABLE aha_commerce_cursors (
 name text PRIMARY KEY,
 value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
 lease_expires_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO aha_commerce_cursors(name,value_json) VALUES ('square-payments',jsonb_build_object('since',now())),('square-disputes','{}');
ALTER TABLE aha_commerce_workers DROP CONSTRAINT aha_commerce_workers_job_check;
ALTER TABLE aha_commerce_workers ADD CONSTRAINT aha_commerce_workers_job_check CHECK(job IN ('fulfillment','notifications','square-recovery'));
INSERT INTO aha_commerce_workers(job) VALUES ('square-recovery');

-- A completed checkout and its recovery obligation commit together, even if the
-- process dies immediately after payment persistence. Repeated updates dedupe.
CREATE FUNCTION aha_checkout_paid_obligation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state='completed' AND NEW.square_payment_id IS NOT NULL AND NEW.square_order_id IS NOT NULL THEN
  INSERT INTO aha_fulfillment_square_events(square_event_id,square_payment_id,event_created_at)
  VALUES ('checkout:' || NEW.checkout_id,NEW.square_payment_id,now()) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aha_checkout_paid_obligation AFTER INSERT OR UPDATE OF state ON aha_checkout_sessions
 FOR EACH ROW EXECUTE FUNCTION aha_checkout_paid_obligation();

CREATE TABLE aha_support_cases (
 id text PRIMARY KEY,
 request_hash text NOT NULL,
 topic text NOT NULL,
 customer_email text NOT NULL,
 message_text text NOT NULL,
 order_reference text,
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','waiting','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE aha_order_notifications DROP CONSTRAINT aha_order_notifications_kind_check;
ALTER TABLE aha_order_notifications ADD CONSTRAINT aha_order_notifications_kind_check CHECK(kind IN ('order_confirmed','order_shipped','cart_reminder','review_request','support_request'));
CREATE INDEX aha_support_open ON aha_support_cases(created_at) WHERE state <> 'resolved';
CREATE TABLE aha_commerce_rate_limits (
 key_hash text NOT NULL,
 window_start timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 1,
 PRIMARY KEY(key_hash,window_start)
);

ALTER TABLE aha_checkout_sessions ADD COLUMN notification_email text;

CREATE TABLE aha_payment_disputes (
 dispute_id text PRIMARY KEY, square_payment_id text NOT NULL, state text NOT NULL,
 due_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX aha_disputes_payment ON aha_payment_disputes(square_payment_id);
