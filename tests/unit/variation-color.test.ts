import { describe, it, expect } from "vitest";
import { extractVariationColor, extractVariationSize, groupVariationsByColor } from "@/lib/utils/variation";

describe("extractVariationColor", () => {
  it("returns the color before a slash or comma", () => {
    expect(extractVariationColor("Black / M")).toBe("Black");
    expect(extractVariationColor("Midnight Navy, L")).toBe("Midnight Navy");
  });
  it("returns empty for size-only labels (preview/single-color)", () => {
    expect(extractVariationColor("M")).toBe("");
    expect(extractVariationColor("2XL")).toBe("");
  });
});

describe("groupVariationsByColor never yields an empty size list", () => {
  const v = (name: string) => ({ id: name, name });

  it("enables + groups when every variation has a color and there are >=2 colors", () => {
    const g = groupVariationsByColor([v("Black / S"), v("Black / M"), v("White / S"), v("White / L")]);
    expect(g.enabled).toBe(true);
    expect(g.colors).toEqual(["Black", "White"]);
    expect(g.byColor.get("Black")!.map((x) => extractVariationSize(x.name))).toEqual(["S", "M"]);
    expect(g.byColor.get("White")!.map((x) => extractVariationSize(x.name))).toEqual(["S", "L"]);
  });

  it("disables (fall back to all sizes) when variations are size-only", () => {
    const g = groupVariationsByColor([v("S"), v("M"), v("L")]);
    expect(g.enabled).toBe(false);
    expect(g.colors).toEqual([]);
  });

  it("disables when only one color exists", () => {
    const g = groupVariationsByColor([v("Black / S"), v("Black / M")]);
    expect(g.enabled).toBe(false);
  });

  it("disables (safe) when color coverage is mixed", () => {
    const g = groupVariationsByColor([v("Black / S"), v("M")]);
    expect(g.enabled).toBe(false);
  });
});
