import { describe, expect, it } from "vitest";
import { loadProducts } from "@/lib/data/products";

describe("provider-neutral catalog loader", () => {
  it("defaults every existing catalog row to Printful until an APLIIQ map is approved", () => {
    const variants = loadProducts().flatMap((product) => product.variants);
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every((variant) => variant.fulfillmentProvider === "printful")).toBe(true);
  });
});
