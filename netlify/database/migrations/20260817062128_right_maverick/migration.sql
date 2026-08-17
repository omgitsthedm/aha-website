ALTER TABLE "product_variants" DROP CONSTRAINT "uniq_variants_provider_variant";--> statement-breakpoint
ALTER TABLE "product_variants" DROP CONSTRAINT "uniq_variants_provider_sku";--> statement-breakpoint
-- Add nullable first so legacy rows can receive a deterministic claim before
-- the NOT NULL and per-order uniqueness guarantees are enforced.
ALTER TABLE "fulfillments" ADD COLUMN "provider_claim_key" text;--> statement-breakpoint
UPDATE "fulfillments"
SET "provider_claim_key" = CASE
	WHEN "fulfillment_provider" = 'printful' AND "provider_store_id" IS NOT NULL
		THEN 'printful:' || "provider_store_id"::text
	WHEN "fulfillment_provider" = 'printful'
		THEN 'printful:legacy:' || "id"::text
	ELSE "fulfillment_provider" || ':default'
END
WHERE "provider_claim_key" IS NULL;--> statement-breakpoint
ALTER TABLE "fulfillments" ALTER COLUMN "provider_claim_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "uniq_fulfillment_order_claim" UNIQUE("order_id","provider_claim_key");--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "uniq_fulfillment_provider_request" UNIQUE("fulfillment_provider","provider_request_id");--> statement-breakpoint
ALTER TABLE "provider_product_drafts" DROP CONSTRAINT "uniq_provider_product_draft";--> statement-breakpoint
ALTER TABLE "provider_product_drafts" ADD CONSTRAINT "uniq_provider_product_draft" UNIQUE NULLS NOT DISTINCT("provider","provider_product_id","provider_variant_id");--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "chk_fulfillments_fulfillment_provider" CHECK ("fulfillment_provider" in ('printful', 'apliiq'));--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "chk_order_items_fulfillment_provider" CHECK ("fulfillment_provider" in ('printful', 'apliiq'));--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variants_fulfillment_provider" CHECK ("fulfillment_provider" in ('printful', 'apliiq'));--> statement-breakpoint
ALTER TABLE "provider_product_drafts" ADD CONSTRAINT "chk_provider_product_drafts_provider" CHECK ("provider" in ('printful', 'apliiq'));--> statement-breakpoint
ALTER TABLE "provider_product_drafts" ADD CONSTRAINT "chk_provider_product_drafts_status" CHECK ("status" in ('pending_review', 'approved', 'rejected', 'archived'));--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "chk_shipments_fulfillment_provider" CHECK ("fulfillment_provider" in ('printful', 'apliiq'));
