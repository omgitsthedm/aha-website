import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadProducts } from "@/lib/data/products";
import { parseApliiqMapDocument } from "@/lib/data/apliiq-map";
import { SELLABLE_PRODUCT_SLUGS } from "@/lib/commerce/sellable-slugs.generated";

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

    // The capsule is exactly the committed APLIIQ registry: one map entry per
    // sellable variant, and every entry keyed by a sellable product slug.
    const registry = parseApliiqMapDocument(JSON.parse(readFileSync("data/apliiq-map.json", "utf8"))).map;
    expect(apliiq).toHaveLength(Object.keys(registry).length);
    expect(apliiq.length).toBeGreaterThanOrEqual(65);
    expect(printful.length).toBeGreaterThan(1000);
    expect(printful.every((v) => (v.fulfillmentProvider ?? "printful") === "printful")).toBe(true);

    // Every APLIIQ variant belongs to a sellable capsule product and carries a mapping.
    for (const product of loadProducts()) {
      for (const v of product.variants) {
        if (v.fulfillmentProvider === "apliiq") {
          expect(SELLABLE_PRODUCT_SLUGS.has(product.slug)).toBe(true);
          expect(registry[v.ahaVariantId]).toBeDefined();
        }
      }
    }
  });
});
