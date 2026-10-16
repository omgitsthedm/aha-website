-- Link a checkout to its anonymous analytics visitor and session so abandoned
-- carts are counted exactly and can be opened as session replays. Both values
-- are random PostHog identifiers, never customer details.
ALTER TABLE aha_checkout_sessions
  ADD COLUMN posthog_distinct_id text,
  ADD COLUMN posthog_session_id text;

CREATE INDEX aha_checkout_sessions_created_idx
  ON aha_checkout_sessions (created_at);
