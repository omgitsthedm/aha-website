CREATE TABLE "abandoned_carts" (
	"id" bigserial PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"items_json" jsonb DEFAULT '[]' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"notified_at" timestamp with time zone,
	"recovered_at" timestamp with time zone,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_abandoned_notified" ON "abandoned_carts" ("notified_at");