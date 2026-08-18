import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  APLIIQ_FULFILLMENT_FEE_CENTS_DEFAULT, ORDER_ITEM_FULFILLMENT_STATUS, PAYMENT_STATUS,
  PROVIDER_RECOVERY_TIER, fulfillments, orderItems, orders, productVariants, refundAuditLog,
} from "@/db/schema";
import { aggregateFulfillmentStatus } from "@/lib/commerce/fulfillment-state";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../netlify/database/migrations", import.meta.url));

/** Migration folders only; " 2" siblings are inert iCloud duplicates. */
const migrationDirs = (): string[] =>
  readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

const migrationSql = (dir: string): string =>
  readFileSync(`${MIGRATIONS_DIR}/${dir}/migration.sql`, "utf8");

const landedCostMigration = (): string => {
  const dirs = migrationDirs().filter((dir) => migrationSql(dir).includes('CREATE TABLE "refund_audit_log"'));
  expect(dirs).toHaveLength(1);
  return dirs[0];
};

// Documented APLIIQ US rate ladder (sheet dated 2026-05-12): MaxWeight_Oz keys.
// Steps are irregular — this is the literal ceiling list, not a generated range.
const APLIIQ_TIER_CEILINGS_OZ = [
  7.9, 11.9, 15.9, 31.9, 47.9, 63.9, 79.9, 95.9, 111.9, 127.9, 143.99, 159.84, 239.84, 319.84, 399.84, 479.84,
];

describe("product_variants APLIIQ landed-cost inputs", () => {
  const columns = getTableColumns(productVariants);

  it("adds every landed-cost input as nullable so legacy Printful rows stay valid", () => {
    for (const column of [
      columns.apliiqItemCostCents, columns.apliiqShippingCostCents,
      columns.apliiqFulfillmentFeeCents, columns.apliiqDestinationTaxCents, columns.weightOz,
    ]) {
      expect(column.notNull).toBe(false);
    }
    expect(columns.apliiqItemCostCents.name).toBe("apliiq_item_cost_cents");
    expect(columns.apliiqShippingCostCents.name).toBe("apliiq_shipping_cost_cents");
    expect(columns.apliiqDestinationTaxCents.name).toBe("apliiq_destination_tax_cents");
    for (const column of [
      columns.apliiqItemCostCents, columns.apliiqShippingCostCents,
      columns.apliiqFulfillmentFeeCents, columns.apliiqDestinationTaxCents,
    ]) {
      expect(column.getSQLType()).toBe("integer");
    }
  });

  it("defaults the per-product APLIIQ fulfillment fee to one dollar", () => {
    expect(APLIIQ_FULFILLMENT_FEE_CENTS_DEFAULT).toBe(100);
    expect(columns.apliiqFulfillmentFeeCents.default).toBe(APLIIQ_FULFILLMENT_FEE_CENTS_DEFAULT);
    expect(migrationSql(landedCostMigration()))
      .toContain('ADD COLUMN "apliiq_fulfillment_fee_cents" integer DEFAULT 100');
  });

  it("stores weight with enough precision to address the irregular rate ladder", () => {
    expect(columns.weightOz.name).toBe("weight_oz");
    expect(columns.weightOz.getSQLType()).toBe("numeric(8, 2)");
    // Whole ounces cannot express a 7.9 or 143.99 ceiling; two decimals can
    // express every documented ceiling exactly.
    for (const ceiling of APLIIQ_TIER_CEILINGS_OZ) {
      expect(Number(ceiling.toFixed(2))).toBe(ceiling);
      expect(Number.isInteger(ceiling)).toBe(false);
    }
    expect(APLIIQ_TIER_CEILINGS_OZ.every((ceiling) => ceiling < 999_999.99)).toBe(true);
  });
});

describe("orders partial-refund support", () => {
  const columns = getTableColumns(orders);

  it("tracks refunded value without rewriting the captured total", () => {
    expect(columns.refundedAmountCents.name).toBe("refunded_amount_cents");
    expect(columns.refundedAmountCents.getSQLType()).toBe("integer");
    expect(columns.refundedAmountCents.notNull).toBe(true);
    expect(columns.refundedAmountCents.default).toBe(0);
    // The captured amount must remain untouched by this change.
    expect(columns.totalAmount.notNull).toBe(true);
    expect(columns.totalAmount.default).toBe(0);
  });

  it("carries partially_refunded in the vocabulary with no database constraint to widen", () => {
    expect(PAYMENT_STATUS).toContain("partially_refunded");
    // Every status any current writer persists must stay legal.
    for (const legacy of ["created", "paid", "payment_failed", "refunded"]) {
      expect(PAYMENT_STATUS).toContain(legacy);
    }
    // payment_status is plain text with no CHECK, which is what makes this
    // migration additive: an older server writing 'refunded' keeps working.
    expect(columns.paymentStatus.getSQLType()).toBe("text");
    const checks = getTableConfig(orders).checks.map((check) => check.name);
    expect(checks).toEqual([]);
    for (const dir of migrationDirs()) {
      expect(migrationSql(dir)).not.toMatch(/CHECK\s*\([^)]*payment_status/i);
    }
  });
});

describe("order_items cancellation support", () => {
  const columns = getTableColumns(orderItems);

  it("records a cancelled value per line rather than a boolean flag", () => {
    expect(columns.cancelledAmountCents.name).toBe("cancelled_amount_cents");
    expect(columns.cancelledAmountCents.getSQLType()).toBe("integer");
    expect(columns.cancelledAmountCents.notNull).toBe(true);
    expect(columns.cancelledAmountCents.default).toBe(0);
  });

  it("can carry cancelled and refunded line states", () => {
    expect(columns.fulfillmentStatus.getSQLType()).toBe("text");
    expect(columns.fulfillmentStatus.default).toBe("not_started");
    expect(ORDER_ITEM_FULFILLMENT_STATUS).toContain("canceled");
    expect(ORDER_ITEM_FULFILLMENT_STATUS).toContain("refunded");
  });

  it("uses the one-L internal spelling the rest of the pipeline compares against", () => {
    // lib/commerce/apliiq-webhook-events.ts normalizes APLIIQ's "cancelled" to
    // "canceled" before it ever reaches the database. A two-L value here would
    // silently never match aggregateFulfillmentStatus.
    expect(aggregateFulfillmentStatus(["canceled"])).toBe("canceled");
    expect(ORDER_ITEM_FULFILLMENT_STATUS).not.toContain("cancelled");
    // Every order-level aggregate outcome must be representable per line.
    const aggregateOutcomes = [
      aggregateFulfillmentStatus([]),
      aggregateFulfillmentStatus(["manual_review"]),
      aggregateFulfillmentStatus(["canceled"]),
      aggregateFulfillmentStatus(["delivered"]),
      aggregateFulfillmentStatus(["shipped", "delivered"]),
      aggregateFulfillmentStatus(["shipped", "confirmed"]),
      aggregateFulfillmentStatus(["confirmed"]),
      aggregateFulfillmentStatus(["draft_created"]),
      aggregateFulfillmentStatus(["draft_creating"]),
      aggregateFulfillmentStatus(["queued"]),
    ];
    for (const outcome of aggregateOutcomes) {
      expect(ORDER_ITEM_FULFILLMENT_STATUS).toContain(outcome);
    }
  });
});

describe("refund_audit_log", () => {
  const columns = getTableColumns(refundAuditLog);
  const config = getTableConfig(refundAuditLog);

  it("dedupes on the Square refund id", () => {
    expect(config.name).toBe("refund_audit_log");
    expect(columns.squareRefundId.name).toBe("square_refund_id");
    expect(columns.squareRefundId.notNull).toBe(true);
    expect(columns.squareRefundId.isUnique).toBe(true);
  });

  it("requires order, payment, amount, reason and actor on every row", () => {
    for (const column of [
      columns.orderId, columns.squarePaymentId, columns.amountCents,
      columns.reason, columns.actor, columns.createdAt,
    ]) {
      expect(column.notNull).toBe(true);
    }
    expect(columns.amountCents.getSQLType()).toBe("integer");
    expect(columns.currency.default).toBe("USD");
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.indexes.map((index) => index.config.name)).toContain("idx_refund_audit_log_order");
  });

  it("distinguishes unreconciled provider recovery from a zero recovery", () => {
    // NULL = not reconciled yet; 0 = reconciled, recovered nothing (post-print).
    expect(columns.recoveredAmountCents.notNull).toBe(false);
    expect(columns.recoveredAmountCents.default).toBeUndefined();
    expect(columns.providerRecoveryTier.notNull).toBe(false);
  });

  it("constrains the recovery tier to the documented APLIIQ cancellation ladder", () => {
    expect([...PROVIDER_RECOVERY_TIER]).toEqual(["pre_garment", "post_garment", "post_print"]);
    expect(config.checks.map((check) => check.name)).toContain("chk_refund_audit_log_recovery_tier");
    const sql = migrationSql(landedCostMigration());
    for (const tier of PROVIDER_RECOVERY_TIER) {
      expect(sql).toContain(`'${tier}'`);
    }
  });
});

describe("fulfillments receipt reconciliation", () => {
  const columns = getTableColumns(fulfillments);
  const config = getTableConfig(fulfillments);

  it("records the provider receipt without disturbing existing fulfillment state", () => {
    for (const column of [
      columns.providerTotalQty, columns.providerTotalCents,
      columns.providerReceiptAt, columns.attentionAt, columns.attentionReason,
    ]) {
      expect(column.notNull).toBe(false);
    }
    expect(columns.providerTotalQty.name).toBe("provider_total_qty");
    expect(columns.providerTotalQty.getSQLType()).toBe("integer");
    expect(columns.providerTotalCents.getSQLType()).toBe("integer");
    // Flagging a row for attention must not overwrite `status`.
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("not_started");
  });

  it("indexes the aged/attention sweep", () => {
    const indexes = config.indexes.map((index) => index.config.name);
    expect(indexes).toContain("idx_fulfillments_attention");
    expect(indexes).toContain("idx_fulfillments_provider_receipt");
  });
});

describe("the landed-cost migration", () => {
  it("is the newest migration and links to the previous snapshot", () => {
    const dirs = migrationDirs();
    const target = landedCostMigration();
    expect(dirs[dirs.length - 1]).toBe(target);

    const previous = JSON.parse(readFileSync(`${MIGRATIONS_DIR}/${dirs[dirs.length - 2]}/snapshot.json`, "utf8"));
    const current = JSON.parse(readFileSync(`${MIGRATIONS_DIR}/${target}/snapshot.json`, "utf8"));
    expect(current.prevIds).toContain(previous.id);
    expect(current.renames).toEqual([]);
  });

  it("is additive only, so an older server keeps running against it", () => {
    const sql = migrationSql(landedCostMigration());
    for (const destructive of [
      /\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bDROP\s+CONSTRAINT\b/i,
      /\bALTER\s+COLUMN\b/i, /\bRENAME\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i,
    ]) {
      expect(sql).not.toMatch(destructive);
    }
  });

  it("ships DDL for every new column", () => {
    const sql = migrationSql(landedCostMigration());
    const expected: [string, string][] = [
      ["product_variants", "apliiq_item_cost_cents"],
      ["product_variants", "apliiq_shipping_cost_cents"],
      ["product_variants", "apliiq_fulfillment_fee_cents"],
      ["product_variants", "apliiq_destination_tax_cents"],
      ["product_variants", "weight_oz"],
      ["orders", "refunded_amount_cents"],
      ["order_items", "cancelled_amount_cents"],
      ["fulfillments", "provider_total_qty"],
      ["fulfillments", "provider_total_cents"],
      ["fulfillments", "provider_receipt_at"],
      ["fulfillments", "attention_at"],
      ["fulfillments", "attention_reason"],
    ];
    for (const [table, column] of expected) {
      expect(sql).toContain(`ALTER TABLE "${table}" ADD COLUMN "${column}"`);
    }
    expect(sql).toContain('CREATE TABLE "refund_audit_log"');
  });
});
