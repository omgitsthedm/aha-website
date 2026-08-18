import { describe, expect, it } from "vitest";
import { loadProducts } from "@/lib/data/products";

describe("provider-neutral catalog loader", () => {
  it("keeps every LEGACY catalog row on Printful, and only the APLIIQ capsule on apliiq", () => {
    // Was "every row defaults to Printful". The 2026-08-18 capsule added 50
    // APLIIQ variants, so the useful invariant is now the SPLIT: nothing that
    // was already here may drift onto the APLIIQ path, because that is what
    // would put a retired product back on sale.
    const variants = loadProducts().flatMap((product) => product.variants);
    expect(variants.length).toBeGreaterThan(0);

    const apliiq = variants.filter((v) => v.fulfillmentProvider === "apliiq");
    const printful = variants.filter((v) => v.fulfillmentProvider !== "apliiq");

    expect(apliiq).toHaveLength(50);
    expect(printful.length).toBeGreaterThan(1000);
    expect(printful.every((v) => (v.fulfillmentProvider ?? "printful") === "printful")).toBe(true);

    // Every APLIIQ variant belongs to a capsule product and carries a mapping.
    const capsule = new Set([
      "black-sheep-tee", "no-kings-tee", "read-banned-books-tee",
      "dont-lick-the-boot-tee", "sheep-min-hoodie", "enemy-of-the-state-hoodie",
    ]);
    for (const product of loadProducts()) {
      for (const v of product.variants) {
        if (v.fulfillmentProvider === "apliiq") expect(capsule.has(product.slug)).toBe(true);
      }
    }
  });
});
