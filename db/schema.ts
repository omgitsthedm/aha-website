// After Hours Agenda — operational schema (Netlify DB / Neon, Drizzle).
// Managed by Netlify: migrations in netlify/database/migrations auto-apply on deploy.
// Rules (§14): external IDs stored; purchase-time snapshots; payment vs fulfillment status
// SEPARATE; raw webhook payloads stored + deduped; no card data; no API tokens; minimize PII.
import {
  pgTable, serial, bigserial, bigint, text, integer, numeric, boolean, timestamp, jsonb, unique, uniqueIndex, index, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const cents = (name: string) => integer(name);
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

/**
 * APLIIQ bills a $1.00 fulfillment fee PER PRODUCT (not per order), on top of
 * product cost and separately-billed freight. Exported so the database default
 * and the landed-cost calculator cannot drift apart.
 */
export const APLIIQ_FULFILLMENT_FEE_CENTS_DEFAULT = 100;

// ── Status vocabularies ──────────────────────────────────────────────────────
// These columns are plain `text` in Postgres with NO check constraint (verified
// against netlify/database/migrations/20260709071003_init_aha/migration.sql).
// The vocabulary is therefore enforced in TypeScript, not in DDL: widening it is
// a code change, never a migration, and an older server that still writes an
// earlier value keeps running unchanged against the new schema.
export const PAYMENT_STATUS = [
  "created", "paid", "payment_failed", "partially_refunded", "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

// Internal spelling is "canceled" (one L). APLIIQ sends "cancelled" and
// lib/commerce/apliiq-webhook-events.ts already normalizes it to "canceled";
// matching that here keeps item state directly comparable with
// orders.fulfillment_status and aggregateFulfillmentStatus().
export const ORDER_ITEM_FULFILLMENT_STATUS = [
  "not_started", "queued", "draft_creating", "draft_created", "confirmed",
  "partially_shipped", "shipped", "delivered", "manual_review", "canceled", "refunded",
] as const;
export type OrderItemFulfillmentStatus = (typeof ORDER_ITEM_FULFILLMENT_STATUS)[number];

// APLIIQ cancellation ladder: 100% refund pre-garment; 100% shipping + 20% of
// product post-garment; shipping only post-print. Determines how much of a
// customer refund we can recover from the provider.
export const PROVIDER_RECOVERY_TIER = ["pre_garment", "post_garment", "post_print"] as const;
export type ProviderRecoveryTier = (typeof PROVIDER_RECOVERY_TIER)[number];

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
  // Provider-neutral catalog identity. The Printful columns remain the legacy
  // record and are intentionally retained for historical orders and rollback.
  fulfillmentProvider: text("fulfillment_provider").notNull().default("printful"),
  providerProductId: text("provider_product_id"),
  providerVariantId: text("provider_variant_id"),
  providerSku: text("provider_sku"),
  providerDataJson: jsonb("provider_data_json"),
  printfulCatalogProductId: integer("printful_catalog_product_id"),
  printfulCatalogVariantId: integer("printful_catalog_variant_id"),
  printfulPlacementsJson: jsonb("printful_placements_json"),
  costEstimate: cents("cost_estimate"),
  // ── APLIIQ landed-cost inputs (margin gating) ──────────────────────────────
  // All nullable: legacy Printful variants have no APLIIQ cost record and must
  // stay valid. NULL means "not costed yet" — the margin gate must treat that as
  // unknown and refuse to bless the SKU, never as zero.
  apliiqItemCostCents: cents("apliiq_item_cost_cents"),
  // APLIIQ bills freight SEPARATELY from product cost, by weight tier and
  // destination. ASSUMPTION (decided): this column holds the CONSERVATIVE
  // single-unit tier rate for this variant's weight. A multi-item order
  // amortises freight better, so gating on the single-unit rate can never bless
  // an underwater SKU.
  apliiqShippingCostCents: cents("apliiq_shipping_cost_cents"),
  // $1.00 per PRODUCT (not per order). Defaulted in DDL so existing rows and
  // any older server that does not yet write this column still read a sane fee.
  apliiqFulfillmentFeeCents: cents("apliiq_fulfillment_fee_cents").default(APLIIQ_FULFILLMENT_FEE_CENTS_DEFAULT),
  // Destination sales tax APLIIQ actually invoiced AHA on this line. APLIIQ
  // bills it per DESTINATION (9.5% on CA shipping addresses only), which a
  // per-variant gate cannot know, so the model uses a blended expected rate —
  // see APLIIQ_DESTINATION_TAX_BASIS_POINTS in lib/commerce/margin.ts. This
  // column is the exact-invoice override, not a rate: NULL means "use the
  // modelled term", 0 means "APLIIQ invoiced no tax on this line".
  apliiqDestinationTaxCents: cents("apliiq_destination_tax_cents"),
  // Shipped weight in ounces, 2dp. NOT an integer: the APLIIQ rate ladder has
  // irregular fractional tier ceilings (7.9, 11.9, 15.9, 31.9 … 143.99, 159.84),
  // so whole ounces cannot address the ladder correctly. numeric (not float)
  // keeps a stored 7.90 exactly equal to the 7.9 tier ceiling.
  weightOz: numeric("weight_oz", { precision: 8, scale: 2, mode: "number" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  byProduct: index("idx_variants_product").on(t.productId),
  validProvider: check("chk_variants_fulfillment_provider", sql`${t.fulfillmentProvider} in ('printful', 'apliiq')`),
}));

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
// Inbound provider catalog records remain review-only until an operator maps
// and approves them into data/apliiq-map.json. No callback handler writes live
// catalog or Square records directly.
export const providerProductDrafts = pgTable("provider_product_drafts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  provider: text("provider").notNull(),
  providerProductId: text("provider_product_id").notNull(),
  providerVariantId: text("provider_variant_id"),
  providerSku: text("provider_sku"),
  status: text("status").notNull().default("pending_review"),
  payloadJson: jsonb("payload_json").notNull().default({}),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  uniqProviderDraft: unique("uniq_provider_product_draft").on(t.provider, t.providerProductId, t.providerVariantId).nullsNotDistinct(),
  byProviderStatus: index("idx_provider_product_drafts_status").on(t.provider, t.status, t.createdAt),
  validProvider: check("chk_provider_product_drafts_provider", sql`${t.provider} in ('printful', 'apliiq')`),
  validStatus: check("chk_provider_product_drafts_status", sql`${t.status} in ('pending_review', 'approved', 'rejected', 'archived')`),
}));

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
  // Running total actually refunded to the shopper. Kept separate from
  // totalAmount so the captured amount is never rewritten, and defaulted to 0 so
  // partial-refund arithmetic never has to coalesce a NULL.
  refundedAmountCents: cents("refunded_amount_cents").notNull().default(0),
  // See PAYMENT_STATUS: unconstrained text in Postgres, so 'partially_refunded'
  // needs no DDL change; the union is enforced at compile time only.
  paymentStatus: text("payment_status").$type<PaymentStatus>().notNull().default("created"),
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
  fulfillmentProvider: text("fulfillment_provider").notNull().default("printful"),
  providerVariantId: text("provider_variant_id"), providerSku: text("provider_sku"),
  providerSnapshotJson: jsonb("provider_snapshot_json"),
  printfulPlacementSnapshotJson: jsonb("printful_placement_snapshot_json"), printfulFileSnapshotJson: jsonb("printful_file_snapshot_json"),
  // Was dead until the refund/cancellation work: it now carries per-line
  // 'canceled' / 'refunded'. Plain text in Postgres (no CHECK), so the
  // vocabulary lives in ORDER_ITEM_FULFILLMENT_STATUS.
  fulfillmentStatus: text("fulfillment_status").$type<OrderItemFulfillmentStatus>().notNull().default("not_started"),
  // Value of this line cancelled/refunded so far, in cents. A partial cancel
  // ships a subset of the line, so this is an amount, not a flag. Never exceeds
  // lineTotal; 0 means nothing cancelled.
  cancelledAmountCents: cents("cancelled_amount_cents").notNull().default(0),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({
  byOrder: index("idx_order_items_order").on(t.orderId),
  validProvider: check("chk_order_items_fulfillment_provider", sql`${t.fulfillmentProvider} in ('printful', 'apliiq')`),
}));

export const payments = pgTable("payments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  squarePaymentId: text("square_payment_id").unique(), status: text("status").notNull(),
  amount: cents("amount").notNull(), currency: text("currency").notNull().default("USD"),
  idempotencyKey: text("idempotency_key").unique(), createdAt: createdAt(),
});
// One row per Square refund we issue, plus what (if anything) we recovered from
// the fulfillment provider for the same event. Square refund id is the natural
// idempotency key: a replayed refund webhook must not double-log.
export const refundAuditLog = pgTable("refund_audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).notNull().references(() => orders.id),
  squarePaymentId: text("square_payment_id").notNull(),
  squareRefundId: text("square_refund_id").notNull().unique(),
  amountCents: cents("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  reason: text("reason").notNull(),
  // Who issued it, e.g. "webhook:square" or an ops identity. Required — an
  // unattributed refund is not an audit record.
  actor: text("actor").notNull(),
  // Which APLIIQ cancellation tier applied. NULL until the provider
  // cancellation is attempted, or when the refund had no provider leg at all.
  providerRecoveryTier: text("provider_recovery_tier").$type<ProviderRecoveryTier>(),
  // NULL = provider recovery not reconciled yet. 0 = reconciled and recovered
  // nothing (post-print). The distinction drives the ops attention queue, so do
  // not collapse it to a 0 default.
  recoveredAmountCents: cents("recovered_amount_cents"),
  createdAt: createdAt(),
}, (t) => ({
  byOrder: index("idx_refund_audit_log_order").on(t.orderId, t.createdAt),
  // Passes for NULL by SQL three-valued logic, which is what "not reconciled
  // yet" needs.
  validRecoveryTier: check("chk_refund_audit_log_recovery_tier",
    sql`${t.providerRecoveryTier} in ('pre_garment', 'post_garment', 'post_print')`),
}));
export const fulfillments = pgTable("fulfillments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  providerStoreId: integer("provider_store_id"),
  fulfillmentProvider: text("fulfillment_provider").notNull().default("printful"),
  // Required idempotent claim boundary within an AHA order. Examples:
  // printful:<store-id>, apliiq:default.
  providerClaimKey: text("provider_claim_key").notNull(),
  providerReference: text("provider_reference"), providerRequestId: text("provider_request_id"),
  providerOrderId: text("provider_order_id"), providerDataJson: jsonb("provider_data_json"),
  printfulOrderId: text("printful_order_id").unique(), status: text("status").notNull().default("not_started"),
  lastError: text("last_error"),
  // ── Provider receipt reconciliation ────────────────────────────────────────
  // APLIIQ charges the merchant card at order PROCESSING, not at shipment, and
  // an insufficient-funds hold parks the order in their "unprocessed" tab with
  // NO notification and NO auto-retry. A receipt that never arrives is the only
  // signal we get, so providerReceiptAt is indexed alongside createdAt for the
  // aged sweep.
  providerTotalQty: integer("provider_total_qty"),
  providerTotalCents: cents("provider_total_cents"),
  providerReceiptAt: timestamp("provider_receipt_at", { withTimezone: true }),
  // Attention marker, set by the aged sweep or by a receipt/quantity mismatch.
  // Separate from status so flagging a row never rewrites fulfillment state.
  attentionAt: timestamp("attention_at", { withTimezone: true }),
  attentionReason: text("attention_reason"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => ({
  uniqOrderStore: unique("uniq_fulfillment_order_store").on(t.orderId, t.providerStoreId),
  uniqOrderClaim: unique("uniq_fulfillment_order_claim").on(t.orderId, t.providerClaimKey),
  uniqProviderRequest: unique("uniq_fulfillment_provider_request").on(t.fulfillmentProvider, t.providerRequestId),
  uniqProviderOrder: unique("uniq_fulfillment_provider_order").on(t.fulfillmentProvider, t.providerOrderId),
  byAttention: index("idx_fulfillments_attention").on(t.attentionAt),
  byProviderReceipt: index("idx_fulfillments_provider_receipt").on(t.fulfillmentProvider, t.providerReceiptAt, t.createdAt),
  validProvider: check("chk_fulfillments_fulfillment_provider", sql`${t.fulfillmentProvider} in ('printful', 'apliiq')`),
}));
export const shipments = pgTable("shipments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  fulfillmentProvider: text("fulfillment_provider").notNull().default("printful"),
  providerShipmentId: text("provider_shipment_id"),
  printfulShipmentId: text("printful_shipment_id"), carrier: text("carrier"),
  trackingNumber: text("tracking_number"), trackingUrl: text("tracking_url"), status: text("status"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }), deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  dataJson: jsonb("data_json"),
}, (t) => ({
  // Historical Printful rows predate provider-neutral shipment identity and
  // may contain duplicate/blank provider ids. Enforce race-safe uniqueness on
  // the new APLIIQ path without making the additive migration rewrite history.
  uniqApliiqProviderShipment: uniqueIndex("uniq_apliiq_shipment_provider_id")
    .on(t.fulfillmentProvider, t.providerShipmentId)
    .where(sql`${t.fulfillmentProvider} = 'apliiq' and ${t.providerShipmentId} is not null`),
  validProvider: check("chk_shipments_fulfillment_provider", sql`${t.fulfillmentProvider} in ('printful', 'apliiq')`),
}));

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
  lastError: text("last_error"),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }), createdAt: createdAt(),
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
  sizePurchased: text("size_purchased"), // reviewer's own size, e.g. "M" — real data only, optional
  fit: text("fit"), // "small" | "true" | "large" — reviewer's fit assessment, optional
  verified: boolean("verified").notNull().default(false),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  bySlugStatus: index("idx_reviews_slug_status").on(t.productSlug, t.status),
}));
