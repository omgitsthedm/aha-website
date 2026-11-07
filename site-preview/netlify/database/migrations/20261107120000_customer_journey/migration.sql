-- Evidence-led lifecycle and customer requests. No historical mail backfill.
ALTER TABLE aha_order_notifications DROP CONSTRAINT aha_order_notifications_kind_check;
ALTER TABLE aha_order_notifications ADD CONSTRAINT aha_order_notifications_kind_check
 CHECK(kind IN ('order_confirmed','order_shipped','cart_reminder','review_request','support_request','order_progress'));
CREATE TABLE aha_order_milestones (
 square_order_id text NOT NULL REFERENCES aha_fulfillment_orders(square_order_id),
 stage text NOT NULL CHECK(stage IN ('accepted','creating','ready','delayed','delivered','delivery_issue')),
 rank integer NOT NULL,
 evidence text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(square_order_id,stage)
);
ALTER TABLE aha_fulfillment_orders ADD COLUMN delivered_at timestamptz,
 ADD COLUMN customer_change_hold boolean NOT NULL DEFAULT false,
 ADD COLUMN customer_progress_rank integer NOT NULL DEFAULT 0;
ALTER TABLE aha_support_cases ADD COLUMN request_type text;
CREATE TABLE aha_shipment_tracking (
 square_order_id text NOT NULL REFERENCES aha_fulfillment_orders(square_order_id),
 tracking_number text NOT NULL,
 carrier text,
 tracker_id text UNIQUE,
 items jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'pending',
 provider_updated_at timestamptz,
 delivered_at timestamptz,
 checked_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error_code text,
 PRIMARY KEY(square_order_id,tracking_number)
);
CREATE INDEX aha_tracking_due ON aha_shipment_tracking(next_attempt_at) WHERE delivered_at IS NULL;

ALTER TABLE aha_shipment_tracking ADD COLUMN registration_reserved_at timestamptz;
ALTER TABLE aha_commerce_workers DROP CONSTRAINT aha_commerce_workers_job_check;
ALTER TABLE aha_commerce_workers ADD CONSTRAINT aha_commerce_workers_job_check CHECK(job IN ('fulfillment','notifications','square-recovery','shipment-tracking'));
INSERT INTO aha_commerce_workers(job) VALUES ('shipment-tracking');

CREATE TABLE aha_tracking_budgets (month date PRIMARY KEY, registrations integer NOT NULL CHECK(registrations>=0));
