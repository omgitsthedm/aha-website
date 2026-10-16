-- Storefront email sign-ups: addresses only, stored lowercased, with the page
-- and the wording the visitor agreed to. Nothing is sent from here. Sign-up
-- attempts are keyed by a SHA-256 of the client address and pruned after a day.
CREATE TABLE aha_email_signups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) BETWEEN 6 AND 254),
  source text NOT NULL,
  consent_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_email_signups_created_idx ON aha_email_signups (created_at);

CREATE TABLE aha_signup_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_signup_attempts_client_idx ON aha_signup_attempts (client_key, attempted_at);
