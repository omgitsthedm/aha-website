CREATE TABLE "winback_log" (
	"id" bigserial PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
