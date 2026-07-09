CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"old_status" text,
	"new_status" text,
	"source" text,
	"actor" text,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" bigserial PRIMARY KEY,
	"cart_id" text NOT NULL,
	"aha_variant_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" text PRIMARY KEY,
	"customer_id" bigint,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"data_json" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" bigserial PRIMARY KEY,
	"email" text UNIQUE,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drops" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"launch_date" timestamp with time zone,
	"data_json" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_subscribers" (
	"id" bigserial PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"consent" boolean DEFAULT true NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fulfillments" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint,
	"printful_order_id" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_snapshots" (
	"id" bigserial PRIMARY KEY,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookbook_entries" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"data_json" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint NOT NULL,
	"aha_product_id" text NOT NULL,
	"aha_variant_id" text NOT NULL,
	"sku" text NOT NULL,
	"title_snapshot" text NOT NULL,
	"size_snapshot" text,
	"color_snapshot" text,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"line_total" integer NOT NULL,
	"square_variation_id" text,
	"printful_catalog_variant_id" integer,
	"printful_placement_snapshot_json" jsonb,
	"printful_file_snapshot_json" jsonb,
	"fulfillment_status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" bigserial PRIMARY KEY,
	"external_order_number" text NOT NULL UNIQUE,
	"customer_id" bigint,
	"email" text NOT NULL,
	"phone" text,
	"shipping_name" text,
	"shipping_address_json" jsonb,
	"billing_address_json" jsonb,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal_amount" integer DEFAULT 0 NOT NULL,
	"shipping_amount" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"payment_status" text DEFAULT 'created' NOT NULL,
	"fulfillment_status" text DEFAULT 'not_started' NOT NULL,
	"customer_status" text DEFAULT 'Order received' NOT NULL,
	"square_payment_id" text,
	"square_order_id" text,
	"printful_order_id" text,
	"risk_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint,
	"square_payment_id" text UNIQUE,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"idempotency_key" text UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" bigserial PRIMARY KEY,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printful_v2_catalog_snapshots" (
	"id" bigserial PRIMARY KEY,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printful_v2_variant_map" (
	"aha_variant_id" text PRIMARY KEY,
	"printful_catalog_product_id" integer,
	"printful_catalog_variant_id" integer,
	"placements_json" jsonb,
	"region_availability_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_feed_snapshots" (
	"id" bigserial PRIMARY KEY,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY,
	"product_id" text NOT NULL,
	"sku" text NOT NULL UNIQUE,
	"size" text NOT NULL,
	"color" text,
	"retail_price" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text NOT NULL,
	"square_catalog_object_id" text,
	"square_variation_id" text,
	"square_location_id" text,
	"printful_catalog_product_id" integer,
	"printful_catalog_variant_id" integer,
	"printful_placements_json" jsonb,
	"cost_estimate" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"product_type" text NOT NULL,
	"status" text NOT NULL,
	"retail_price" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"drop_id" text,
	"data_json" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restock_requests" (
	"id" bigserial PRIMARY KEY,
	"aha_variant_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "uniq_restock" UNIQUE("aha_variant_id","email")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint,
	"printful_shipment_id" text,
	"carrier" text,
	"tracking_number" text,
	"tracking_url" text,
	"status" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"data_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "size_guides" (
	"id" text PRIMARY KEY,
	"product_type" text NOT NULL,
	"data_json" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_subscribers" (
	"id" bigserial PRIMARY KEY,
	"phone" text NOT NULL UNIQUE,
	"consent" boolean DEFAULT true NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "square_catalog_map" (
	"aha_variant_id" text PRIMARY KEY,
	"square_catalog_object_id" text,
	"square_variation_id" text,
	"square_location_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigserial PRIMARY KEY,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"detail_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY,
	"provider" text NOT NULL,
	"event_id" text,
	"event_type" text,
	"signature" text,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"dedupe_key" text NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_webhook" UNIQUE("provider","dedupe_key")
);
--> statement-breakpoint
CREATE INDEX "idx_order_items_order" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX "idx_orders_payment_status" ON "orders" ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_orders_fulfillment_status" ON "orders" ("fulfillment_status");--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "product_variants" ("product_id");--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "printful_v2_variant_map" ADD CONSTRAINT "printful_v2_variant_map_aha_variant_id_product_variants_id_fkey" FOREIGN KEY ("aha_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "square_catalog_map" ADD CONSTRAINT "square_catalog_map_aha_variant_id_product_variants_id_fkey" FOREIGN KEY ("aha_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE;