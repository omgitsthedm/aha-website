CREATE TABLE "push_subscriptions" (
	"id" bigserial PRIMARY KEY,
	"order_id" bigint NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_push_subscriptions_order_endpoint" UNIQUE("order_id","endpoint")
);
--> statement-breakpoint
CREATE INDEX "idx_push_subscriptions_order" ON "push_subscriptions" ("order_id");--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;