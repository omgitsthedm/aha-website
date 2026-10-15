CREATE TABLE "review_request_log" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint NOT NULL UNIQUE,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_request_log" ADD CONSTRAINT "review_request_log_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;