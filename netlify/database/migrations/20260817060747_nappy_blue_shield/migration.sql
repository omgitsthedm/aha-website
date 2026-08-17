CREATE TABLE "provider_product_drafts" (
	"id" bigserial PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_product_id" text NOT NULL,
	"provider_variant_id" text,
	"provider_sku" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"payload_json" jsonb DEFAULT '{}' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uniq_provider_product_draft" UNIQUE("provider","provider_product_id","provider_variant_id")
);
--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "fulfillment_provider" text DEFAULT 'printful' NOT NULL;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_reference" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_request_id" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_order_id" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "provider_data_json" jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "fulfillment_provider" text DEFAULT 'printful' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "provider_variant_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "provider_sku" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "provider_snapshot_json" jsonb;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "fulfillment_provider" text DEFAULT 'printful' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "provider_product_id" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "provider_variant_id" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "provider_sku" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "provider_data_json" jsonb;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "fulfillment_provider" text DEFAULT 'printful' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_shipment_id" text;--> statement-breakpoint
-- Legacy records remain Printful records. Populate provider-neutral columns
-- explicitly before enforcing provider-aware uniqueness; no legacy column is
-- renamed, dropped, or overwritten.
UPDATE "product_variants"
SET
  "fulfillment_provider" = 'printful',
  "provider_product_id" = COALESCE("provider_product_id", "printful_catalog_product_id"::text),
  "provider_sku" = COALESCE("provider_sku", "sku"),
  "provider_data_json" = COALESCE(
    "provider_data_json",
    jsonb_strip_nulls(jsonb_build_object(
      'printfulCatalogProductId', "printful_catalog_product_id",
      'printfulCatalogVariantId', "printful_catalog_variant_id",
      'printfulPlacements', "printful_placements_json"
    ))
  );--> statement-breakpoint
UPDATE "order_items"
SET
  "fulfillment_provider" = 'printful',
  "provider_variant_id" = COALESCE("provider_variant_id", "printful_catalog_variant_id"::text),
  "provider_sku" = COALESCE("provider_sku", "sku"),
  "provider_snapshot_json" = COALESCE(
    "provider_snapshot_json",
    jsonb_strip_nulls(jsonb_build_object(
      'printfulCatalogVariantId', "printful_catalog_variant_id",
      'printfulPlacementSnapshot', "printful_placement_snapshot_json",
      'printfulFileSnapshot', "printful_file_snapshot_json"
    ))
  );--> statement-breakpoint
UPDATE "fulfillments"
SET
  "fulfillment_provider" = 'printful',
  "provider_reference" = COALESCE("provider_reference", "printful_order_id"),
  "provider_order_id" = COALESCE("provider_order_id", "printful_order_id"),
  "provider_data_json" = COALESCE(
    "provider_data_json",
    jsonb_strip_nulls(jsonb_build_object(
      'printfulOrderId', "printful_order_id",
      'providerStoreId', "provider_store_id"
    ))
  );--> statement-breakpoint
UPDATE "shipments"
SET
  "fulfillment_provider" = 'printful',
  "provider_shipment_id" = COALESCE("provider_shipment_id", "printful_shipment_id");--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "uniq_fulfillment_provider_order" UNIQUE("fulfillment_provider","provider_order_id");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "uniq_variants_provider_variant" UNIQUE("fulfillment_provider","provider_variant_id");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "uniq_variants_provider_sku" UNIQUE("fulfillment_provider","provider_sku");--> statement-breakpoint
CREATE INDEX "idx_provider_product_drafts_status" ON "provider_product_drafts" ("provider","status","created_at");
