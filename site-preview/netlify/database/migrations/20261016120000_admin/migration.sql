-- Private admin: passkey users, sessions, one-time challenges, an audit log of
-- every write, and publish requests handed to the catalog engine. Session and
-- challenge tokens are stored only as SHA-256 hashes.
CREATE TABLE aha_admin_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aha_admin_credentials (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES aha_admin_users (id) ON DELETE CASCADE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE aha_admin_sessions (
  token_sha256 text PRIMARY KEY,
  user_id text NOT NULL REFERENCES aha_admin_users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE aha_admin_challenges (
  id_sha256 text PRIMARY KEY,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register', 'login')),
  user_id text,
  email text,
  expires_at timestamptz NOT NULL
);

CREATE TABLE aha_admin_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aha_admin_attempts_client_idx ON aha_admin_attempts (client_key, attempted_at);

CREATE TABLE aha_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text,
  action text NOT NULL,
  target text,
  detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE aha_publish_requests (
  id text PRIMARY KEY,
  draft_id text NOT NULL,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'running', 'done', 'failed')),
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
