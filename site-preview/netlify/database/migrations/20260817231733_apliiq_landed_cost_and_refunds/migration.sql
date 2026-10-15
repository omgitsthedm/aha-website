CREATE TABLE "refund_audit_log" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint NOT NULL,
	"square_payment_id" text NOT NULL,
	"square_refund_id" text NOT NULL UNIQUE,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"provider_recovery_tier" text,
	"recovered_amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_refund_audit_log_recovery_tier" CHECK ("provider_recovery_tier" in ('pre_garment', 'post_garment', 'post_print'))
);
--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_total_qty" integer;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_total_cents" integer;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_receipt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "attention_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "attention_reason" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cancelled_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "apliiq_item_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "apliiq_shipping_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "apliiq_fulfillment_fee_cents" integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "apliiq_destination_tax_cents" integer;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "weight_oz" numeric(8,2);--> statement-breakpoint
CREATE INDEX "idx_fulfillments_attention" ON "fulfillments" ("attention_at");--> statement-breakpoint
CREATE INDEX "idx_fulfillments_provider_receipt" ON "fulfillments" ("fulfillment_provider","provider_receipt_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_refund_audit_log_order" ON "refund_audit_log" ("order_id","created_at");--> statement-breakpoint
ALTER TABLE "refund_audit_log" ADD CONSTRAINT "refund_audit_log_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");