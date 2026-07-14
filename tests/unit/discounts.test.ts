import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDiscount } from "@/lib/commerce/discounts";
import { buildSquareOrder } from "@/lib/square/orders";

const save = { code: process.env.PROMO_CODE, pct: process.env.PROMO_PERCENT, label: process.env.PROMO_LABEL };

describe("resolveDiscount", () => {
  beforeEach(() => {
    process.env.PROMO_CODE = "FIRST10";
    process.env.PROMO_PERCENT = "10";
    process.env.PROMO_LABEL = "First order";
  });
  afterEach(() => {
    process.env.PROMO_CODE = save.code;
    process.env.PROMO_PERCENT = save.pct;
    process.env.PROMO_LABEL = save.label;
  });

  it("resolves a matching code (case-insensitive) to the configured discount", () => {
    expect(resolveDiscount("first10")).toEqual({ name: "First order", percentage: "10" });
    expect(resolveDiscount(" FIRST10 ")).toEqual({ name: "First order", percentage: "10" });
  });

  it("returns null for a wrong or empty code", () => {
    expect(resolveDiscount("nope")).toBeNull();
    expect(resolveDiscount("")).toBeNull();
    expect(resolveDiscount(undefined)).toBeNull();
  });

  it("returns null when unconfigured or the percent is out of range", () => {
    delete process.env.PROMO_CODE;
    expect(resolveDiscount("FIRST10")).toBeNull();
    process.env.PROMO_CODE = "FIRST10";
    process.env.PROMO_PERCENT = "0";
    expect(resolveDiscount("FIRST10")).toBeNull();
    process.env.PROMO_PERCENT = "100";
    expect(resolveDiscount("FIRST10")).toBeNull();
  });
});

describe("buildSquareOrder discount wiring", () => {
  it("omits discounts when none is provided", () => {
    const order = buildSquareOrder({ lineItems: [{ catalogObjectId: "v1", quantity: "1" }] });
    expect(order.discounts).toBeUndefined();
  });

  it("emits an ORDER-scoped percentage discount when provided", () => {
    const order = buildSquareOrder({
      lineItems: [{ catalogObjectId: "v1", quantity: "1" }],
      discount: { name: "First order", percentage: "10" },
    });
    expect(order.discounts).toEqual([{ name: "First order", percentage: "10", scope: "ORDER" }]);
  });
});
