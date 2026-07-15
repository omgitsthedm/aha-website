import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDiscount, computeBogoAmount } from "@/lib/commerce/discounts";
import { buildSquareOrder } from "@/lib/square/orders";

const save = {
  code: process.env.PROMO_CODE,
  pct: process.env.PROMO_PERCENT,
  label: process.env.PROMO_LABEL,
  type: process.env.PROMO_TYPE,
};

afterEach(() => {
  process.env.PROMO_CODE = save.code;
  process.env.PROMO_PERCENT = save.pct;
  process.env.PROMO_LABEL = save.label;
  process.env.PROMO_TYPE = save.type;
});

describe("computeBogoAmount (buy 1 get 1 free)", () => {
  it("frees the cheaper of a pair", () => {
    expect(computeBogoAmount([{ unitPrice: 4000, quantity: 1 }, { unitPrice: 3000, quantity: 1 }])).toBe(3000);
  });
  it("needs at least two items", () => {
    expect(computeBogoAmount([{ unitPrice: 4000, quantity: 1 }])).toBe(0);
  });
  it("frees floor(n/2) cheapest across quantities", () => {
    // three $40 tees → one free
    expect(computeBogoAmount([{ unitPrice: 4000, quantity: 3 }])).toBe(4000);
    // four items 40,40,30,20 → two cheapest (20+30) free
    expect(computeBogoAmount([{ unitPrice: 4000, quantity: 2 }, { unitPrice: 3000, quantity: 1 }, { unitPrice: 2000, quantity: 1 }])).toBe(5000);
  });
});

describe("resolveDiscount — bogo", () => {
  beforeEach(() => {
    process.env.PROMO_CODE = "OneOnMe";
    process.env.PROMO_TYPE = "bogo";
    process.env.PROMO_LABEL = "Buy 1, Get 1 Free";
    delete process.env.PROMO_PERCENT;
  });

  it("resolves a matching code + cart to a fixed-amount discount", () => {
    const d = resolveDiscount("oneonme", { items: [{ unitPrice: 4000, quantity: 1 }, { unitPrice: 3000, quantity: 1 }], currency: "USD" });
    expect(d).toEqual({ name: "Buy 1, Get 1 Free", amountMoney: { amount: 3000, currency: "USD" } });
  });
  it("returns null for a single item (no pair)", () => {
    expect(resolveDiscount("OneOnMe", { items: [{ unitPrice: 4000, quantity: 1 }], currency: "USD" })).toBeNull();
  });
  it("returns null for a wrong code or no cart", () => {
    expect(resolveDiscount("nope", { items: [{ unitPrice: 4000, quantity: 2 }], currency: "USD" })).toBeNull();
    expect(resolveDiscount("OneOnMe")).toBeNull();
  });
});

describe("resolveDiscount — percent", () => {
  beforeEach(() => {
    process.env.PROMO_CODE = "FIRST10";
    process.env.PROMO_TYPE = "percent";
    process.env.PROMO_PERCENT = "10";
    process.env.PROMO_LABEL = "First order";
  });
  it("resolves a matching code to a percentage", () => {
    expect(resolveDiscount("first10")).toEqual({ name: "First order", percentage: "10" });
  });
  it("returns null when the percent is out of range", () => {
    process.env.PROMO_PERCENT = "0";
    expect(resolveDiscount("FIRST10")).toBeNull();
  });
});

describe("buildSquareOrder discount wiring", () => {
  it("emits a percentage discount", () => {
    const order = buildSquareOrder({ lineItems: [{ catalogObjectId: "v1", quantity: "1" }], discount: { name: "First order", percentage: "10" } });
    expect(order.discounts).toEqual([{ name: "First order", percentage: "10", scope: "ORDER" }]);
  });
  it("emits a fixed-amount (bogo) discount", () => {
    const order = buildSquareOrder({ lineItems: [{ catalogObjectId: "v1", quantity: "2" }], discount: { name: "Buy 1, Get 1 Free", amountMoney: { amount: 4000, currency: "USD" } } });
    expect(order.discounts).toEqual([{ name: "Buy 1, Get 1 Free", amount_money: { amount: 4000, currency: "USD" }, scope: "ORDER" }]);
  });
  it("omits discounts when none provided", () => {
    const order = buildSquareOrder({ lineItems: [{ catalogObjectId: "v1", quantity: "1" }] });
    expect(order.discounts).toBeUndefined();
  });
});
