import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "netlify/database/migrations/20260817062128_right_maverick/migration.sql"
);

describe("provider persistence hardening migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("backfills a non-null provider claim before adding per-order uniqueness", () => {
    const triggerFunction = sql.indexOf('CREATE FUNCTION "derive_fulfillment_provider_claim_key"');
    const trigger = sql.indexOf('CREATE TRIGGER "trg_derive_fulfillment_provider_claim_key"');
    const backfill = sql.indexOf('UPDATE "fulfillments"');
    const notNull = sql.indexOf('ALTER COLUMN "provider_claim_key" SET NOT NULL');
    const uniqueClaim = sql.indexOf('CONSTRAINT "uniq_fulfillment_order_claim"');
    expect(triggerFunction).toBeGreaterThan(-1);
    expect(trigger).toBeGreaterThan(triggerFunction);
    expect(backfill).toBeGreaterThan(trigger);
    expect(notNull).toBeGreaterThan(backfill);
    expect(uniqueClaim).toBeGreaterThan(notNull);
    expect(sql).toContain("'printful:' || \"provider_store_id\"::text");
    expect(sql).toContain("'printful:legacy:' || \"id\"::text");
  });

  it("keeps old Printful inserts compatible after NOT NULL is enforced", () => {
    const trigger = sql.slice(
      sql.indexOf('CREATE FUNCTION "derive_fulfillment_provider_claim_key"'),
      sql.indexOf('CREATE TRIGGER "trg_derive_fulfillment_provider_claim_key"')
    );
    expect(trigger).toContain('NEW."provider_store_id" IS NOT NULL');
    expect(trigger).toContain("NEW.\"provider_claim_key\" := 'printful:' || NEW.\"provider_store_id\"::text");
    expect(trigger).toContain("NEW.\"provider_claim_key\" := 'printful:default'");
    expect(sql).toMatch(/CREATE TRIGGER[\s\S]+BEFORE INSERT OR UPDATE ON "fulfillments"/);
  });

  it("uses provider-aware request identity and NULL-safe draft dedupe", () => {
    expect(sql).toContain('UNIQUE("fulfillment_provider","provider_request_id")');
    expect(sql).toContain('UNIQUE NULLS NOT DISTINCT("provider","provider_product_id","provider_variant_id")');
  });

  it("removes unsafe mapping uniques without dropping legacy data or columns", () => {
    expect(sql).toContain('DROP CONSTRAINT "uniq_variants_provider_variant"');
    expect(sql).toContain('DROP CONSTRAINT "uniq_variants_provider_sku"');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
  });
});
