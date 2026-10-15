CREATE TABLE "login_tokens" (
	"id" bigserial PRIMARY KEY,
	"token" text NOT NULL UNIQUE,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_login_tokens_email" ON "login_tokens" ("email");