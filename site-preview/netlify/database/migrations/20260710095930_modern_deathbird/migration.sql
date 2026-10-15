ALTER TABLE "fulfillments" ADD COLUMN "provider_store_id" integer;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "uniq_fulfillment_order_store" UNIQUE("order_id","provider_store_id");--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_printful_order_id_key" UNIQUE("printful_order_id");