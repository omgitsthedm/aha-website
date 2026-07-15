// After Hours Agenda — operational schema (Netlify DB / Neon, Drizzle).
// Managed by Netlify: migrations in netlify/database/migrations auto-apply on deploy.
// Rules (§14): external IDs stored; purchase-time snapshots; payment vs fulfillment status
// SEPARATE; raw webhook payloads stored + deduped; no card data; no API tokens; minimize PII.
import {
  pgTable, serial, bigserial, bigint, text, integer, boolean, timestamp, jsonb, unique, index,
} from "drizzle-orm/pg-core";

const cents = (name: string) => integer(name);
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

// ── Catalog (mirror of internal manifest for joins/queries) ──────────────────
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  productType: text("product_type").notNull(),
  status: text("status").notNull(),
  retailPrice: cents("retail_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  dropId: text("drop_id"),
  dataJson: jsonb("data_json").notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const productVariants = pgTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  size: text("size").notNull(),
  color: text("color"),
  retailPrice: cents("retail_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull(),
  squareCatalogObjectId: text("square_catalog_object_id"),
  squareVariationId: text("square_variation_id"),
  squareLocationId: text("square_location_id"),
  printfulCatalogProductId: integer("printful_catalog_product_id"),
  printfulCatalogVariantId: integer("printful_catalog_variant_id"),
  printfulPlacementsJson: jsonb("printful_placements_json"),
  costEstimate: cents("cost_estimate"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({ byProduct: index("idx_variants_product").on(t.productId) }));

export const collections = pgTable("collections", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(),
  title: text("title").notNull(), dataJson: jsonb("data_json").notNull().default({}),
});
export const drops = pgTable("drops", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), title: text("title").notNull(),
  status: text("status").notNull(), launchDate: timestamp("launch_date", { withTimezone: true }),
  dataJson: jsonb("data_json").notNull().default({}),
});
export const sizeGuides = pgTable("size_guides", {
  id: text("id").primaryKey(), productType: text("product_type").notNull(), dataJson: jsonb("data_json").notNull().default({}),
});
export const lookbookEntries = pgTable("lookbook_entries", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), dataJson: jsonb("data_json").notNull().default({}),
});

// ── Mapping tables (glue) ────────────────────────────────────────────────────
export const squareCatalogMap = pgTable("square_catalog_map", {
  ahaVariantId: text("aha_variant_id").primaryKey().references(() => productVariants.id, { onDelete: "cascade" }),
  squareCatalogObjectId: text("square_catalog_object_id"), squareVariationId: text("square_variation_id"),
  squareLocationId: text("square_location_id"), updatedAt: updatedAt(),
});
export const printfulV2VariantMap = pgTable("printful_v2_variant_map", {
  ahaVariantId: text("aha_variant_id").primaryKey().references(() => productVariants.id, { onDelete: "cascade" }),
  printfulCatalogProductId: integer("printful_catalog_product_id"), printfulCatalogVariantId: integer("printful_catalog_variant_id"),
  placementsJson: jsonb("placements_json"), regionAvailabilityJson: jsonb("region_availability_json"), updatedAt: updatedAt(),
});
export const printfulV2CatalogSnapshots = pgTable("printful_v2_catalog_snapshots", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  takenAt: timestamp("taken_at", { withTimezone: true }).defaultNow().notNull(), payloadJson: jsonb("payload_json").notNull(),
});

// ── Customers / carts ────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email").unique(), phone: text("phone"), createdAt: createdAt(),
});
export const carts = pgTable("carts", {
  id: text("id").primaryKey(), customerId: bigint("customer_id", { mode: "number" }).references(() => customers.id),
  status: text("status").notNull().default("open"), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const cartItems = pgTable("cart_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  cartId: text("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  ahaVariantId: text("aha_variant_id").notNull(), quantity: integer("quantity").notNull(),
  unitPrice: cents("unit_price").notNull(), createdAt: createdAt(),
});

// ── Orders (payment vs fulfillment status SEPARATE) ──────────────────────────
export const orders = pgTable("orders", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  externalOrderNumber: text("external_order_number").notNull().unique(),
  customerId: bigint("customer_id", { mode: "number" }).references(() => customers.id),
  email: text("email").notNull(), phone: text("phone"), shippingName: text("shipping_name"),
  shippingAddressJson: jsonb("shipping_address_json"), billingAddressJson: jsonb("billing_address_json"),
  currency: text("currency").notNull().default("USD"),
  subtotalAmount: cents("subtotal_amount").notNull().default(0), shippingAmount: cents("shipping_amount").notNull().default(0),
  taxAmount: cents("tax_amount").notNull().default(0), discountAmount: cents("discount_amount").notNull().default(0),
  totalAmount: cents("total_amount").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("created"),
  fulfillmentStatus: text("fulfillment_status").notNull().default("not_started"),
  customerStatus: text("customer_status").notNull().default("Order received"),
  squarePaymentId: text("square_payment_id"), squareOrderId: text("square_order_id"),
  printfulOrderId: text("printful_order_id"), riskStatus: text("risk_status"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({
  byPayment: index("idx_orders_payment_status").on(t.paymentStatus),
  byFulfillment: index("idx_orders_fulfillment_status").on(t.fulfillmentStatus),
}));

export const orderItems = pgTable("order_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  ahaProductId: text("aha_product_id").notNull(), ahaVariantId: text("aha_variant_id").notNull(),
  sku: text("sku").notNull(), titleSnapshot: text("title_snapshot").notNull(),
  sizeSnapshot: text("size_snapshot"), colorSnapshot: text("color_snapshot"),
  quantity: integer("quantity").notNull(), unitPrice: cents("unit_price").notNull(), lineTotal: cents("line_total").notNull(),
  squareVariationId: text("square_variation_id"), printfulCatalogVariantId: integer("printful_catalog_variant_id"),
  printfulPlacementSnapshotJson: jsonb("printful_placement_snapshot_json"), printfulFileSnapshotJson: jsonb("printful_file_snapshot_json"),
  fulfillmentStatus: text("fulfillment_status").notNull().default("not_started"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ byOrder: index("idx_order_items_order").on(t.orderId) }));

export const payments = pgTable("payments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  squarePaymentId: text("square_payment_id").unique(), status: text("status").notNull(),
  amount: cents("amount").notNull(), currency: text("currency").notNull().default("USD"),
  idempotencyKey: text("idempotency_key").unique(), createdAt: createdAt(),
});
export const fulfillments = pgTable("fulfillments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  providerStoreId: integer("provider_store_id"),
  printfulOrderId: text("printful_order_id").unique(), status: text("status").notNull().default("not_started"),
  lastError: text("last_error"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ uniqOrderStore: unique("uniq_fulfillment_order_store").on(t.orderId, t.providerStoreId) }));
export const shipments = pgTable("shipments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  printfulShipmentId: text("printful_shipment_id"), carrier: text("carrier"),
  trackingNumber: text("tracking_number"), trackingUrl: text("tracking_url"), status: text("status"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }), deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  dataJson: jsonb("data_json"),
});

// ── Growth / retention ───────────────────────────────────────────────────────
export const restockRequests = pgTable("restock_requests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ahaVariantId: text("aha_variant_id").notNull(), email: text("email").notNull(),
  createdAt: createdAt(), notifiedAt: timestamp("notified_at", { withTimezone: true }),
}, (t) => ({ uniqReq: unique("uniq_restock").on(t.ahaVariantId, t.email) }));
export const emailSubscribers = pgTable("email_subscribers", {
  id: bigserial("id", { mode: "number" }).primaryKey(), email: text("email").notNull().unique(),
  consent: boolean("consent").notNull().default(true), source: text("source"), createdAt: createdAt(),
});
export const smsSubscribers = pgTable("sms_subscribers", {
  id: bigserial("id", { mode: "number" }).primaryKey(), phone: text("phone").notNull().unique(),
  consent: boolean("consent").notNull().default(true), source: text("source"), createdAt: createdAt(),
});
// One open in-progress checkout per email. Written non-blocking from /checkout
// when an email + items exist; a scheduled dispatch sends ONE recovery email
// after a delay if no order followed. recoveredAt/notifiedAt gate re-sends.
export const abandonedCarts = pgTable("abandoned_carts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email").notNull().unique(),
  itemsJson: jsonb("items_json").notNull().default([]),
  subtotal: cents("subtotal").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  recoveredAt: timestamp("recovered_at", { withTimezone: true }),
  unsubscribed: boolean("unsubscribed").notNull().default(false),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ byNotified: index("idx_abandoned_notified").on(t.notifiedAt) }));
// One post-purchase review request per order (dedupe). Row inserted only on an
// actual send, so a dry-run never blocks the real send once enabled.
export const reviewRequestLog = pgTable("review_request_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }).unique(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});
// One win-back email per lapsed customer (dedupe). Row inserted only on send.
export const winbackLog = pgTable("winback_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email").notNull().unique(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});
// Passwordless (magic-link) sign-in. One-time tokens, short TTL, single-use.
// No passwords are ever stored. Accounts are OPTIONAL — guest checkout is unchanged.
export const loginTokens = pgTable("login_tokens", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => ({ byEmail: index("idx_login_tokens_email").on(t.email) }));

// ── Webhooks / audit / ops ───────────────────────────────────────────────────
export const webhookEvents = pgTable("webhook_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  provider: text("provider").notNull(), eventId: text("event_id"), eventType: text("event_type"),
  signature: text("signature"), signatureValid: boolean("signature_valid").notNull().default(false),
  rawPayload: jsonb("raw_payload").notNull(), processingStatus: text("processing_status").notNull().default("received"),
  dedupeKey: text("dedupe_key").notNull(), retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"), processedAt: timestamp("processed_at", { withTimezone: true }), createdAt: createdAt(),
}, (t) => ({ uniqEvent: unique("uniq_webhook").on(t.provider, t.dedupeKey) }));
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), action: text("action").notNull(),
  oldStatus: text("old_status"), newStatus: text("new_status"), source: text("source"), actor: text("actor"),
  metadataJson: jsonb("metadata_json"), createdAt: createdAt(),
});
export const notificationOutbox = pgTable("notification_outbox", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), recipient: text("recipient").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(), payloadJson: jsonb("payload_json").notNull().default({}),
  status: text("status").notNull().default("pending"), attempts: integer("attempts").notNull().default(0),
  providerMessageId: text("provider_message_id"), lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({ byStatus: index("idx_notification_outbox_status").on(t.status, t.createdAt) }));
export const syncRuns = pgTable("sync_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(), kind: text("kind").notNull(), status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }), detailJson: jsonb("detail_json"),
});
const snapshotTable = (name: string) => pgTable(name, {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  takenAt: timestamp("taken_at", { withTimezone: true }).defaultNow().notNull(), payloadJson: jsonb("payload_json").notNull(),
});
export const inventorySnapshots = snapshotTable("inventory_snapshots");
export const priceSnapshots = snapshotTable("price_snapshots");
export const productFeedSnapshots = snapshotTable("product_feed_snapshots");

// Web Push: one row per (order, browser endpoint). Created from the
// track-order page after the shopper proves order number + email; consumed
// once when the shipped webhook fires. Endpoint URLs are capability URLs —
// treat like PII, delete on 404/410 from the push service.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => ({
  byOrderEndpoint: unique("uq_push_subscriptions_order_endpoint").on(t.orderId, t.endpoint),
  byOrder: index("idx_push_subscriptions_order").on(t.orderId),
}));

// Product reviews. Submitted from the PDP; start as "pending" and only show once
// "approved" via ops moderation (no fake or auto-published ratings — honesty law).
// email is contact-only (never displayed). orderNumber, when matched to a real
// paid order, marks the review a verified purchase.
export const reviews = pgTable("reviews", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  productSlug: text("product_slug").notNull(),
  rating: integer("rating").notNull(), // 1–5
  title: text("title"),
  body: text("body").notNull(),
  authorName: text("author_name").notNull(),
  email: text("email"), // contact only, not displayed
  orderNumber: text("order_number"),
  verified: boolean("verified").notNull().default(false),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  bySlugStatus: index("idx_reviews_slug_status").on(t.productSlug, t.status),
}));
