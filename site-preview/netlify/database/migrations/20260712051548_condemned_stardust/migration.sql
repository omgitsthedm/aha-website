CREATE TABLE "notification_outbox" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"dedupe_key" text NOT NULL UNIQUE,
	"payload_json" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_notification_outbox_status" ON "notification_outbox" ("status","created_at");--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;