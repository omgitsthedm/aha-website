import { describe, expect, it } from "vitest";
import { extractVariationSize } from "@/lib/utils/variation";

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
