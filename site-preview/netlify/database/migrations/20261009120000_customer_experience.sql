-- Additive website measurement and consent records. No historical records are changed.
CREATE TABLE IF NOT EXISTS aha_site_metrics (
 day date NOT NULL, path text NOT NULL, event text NOT NULL,
 device text NOT NULL CHECK (device IN ('mobile','desktop')),
 bucket integer NOT NULL DEFAULT 0 CHECK (bucket>=0), count bigint NOT NULL DEFAULT 0 CHECK(count>=0),
 PRIMARY KEY(day,path,event,device,bucket)
);
CREATE TABLE IF NOT EXISTS aha_marketing_preferences (
 email text PRIMARY KEY, consent boolean NOT NULL,
 source text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
