CREATE TABLE "reviews" (
	"id" bigserial PRIMARY KEY,
	"product_slug" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"author_name" text NOT NULL,
	"email" text,
	"order_number" text,
	"verified" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_reviews_slug_status" ON "reviews" ("product_slug","status");