import { describe, expect, it } from "vitest";
import { extractVariationSize, sortVariationsBySize } from "@/lib/utils/variation";

describe("extractVariationSize", () => {
  it.each([
    ["S", "S"],
    ["Black, S", "S"],
    ["Navy Blazer / 2XL", "2XL"],
    ["Charcoal Heather, 3XL", "3XL"],
  ])("extracts the apparel size from %s", (label, expected) => {
    expect(extractVariationSize(label)).toBe(expected);
  });
});

describe("sortVariationsBySize", () => {
  it("puts apparel sizes in shopper order without mutating the catalog array", () => {
    const variations = ["2XL", "L", "S", "XL", "M"].map((name) => ({ name }));
    expect(sortVariationsBySize(variations).map(({ name }) => name)).toEqual(["S", "M", "L", "XL", "2XL"]);
    expect(variations.map(({ name }) => name)).toEqual(["2XL", "L", "S", "XL", "M"]);
  });

  it("sorts color-prefixed labels by their extracted size", () => {
    const variations = ["Black / 3XL", "Black / M", "Black / XL"].map((name) => ({ name }));
    expect(sortVariationsBySize(variations).map(({ name }) => name)).toEqual(["Black / M", "Black / XL", "Black / 3XL"]);
  });
});
