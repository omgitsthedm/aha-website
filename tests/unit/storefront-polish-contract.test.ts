import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (relativePath: string): string => readFileSync(`${ROOT}${relativePath}`, "utf8");

describe("storefront polish contract", () => {
  it("never presents synchronous catalog reveals as a loading spinner", () => {
    for (const component of [
      "components/shop/ShopContent.tsx",
      "components/shop/CategoryShopContent.tsx",
    ]) {
      const source = read(component);
      expect(source).toContain("Show more products");
      expect(source).not.toContain("Loading more");
      expect(source).not.toContain("animate-spin");
    }
  });

  it("recovers from an empty category through sellable collections only", () => {
    const source = read("components/shop/CategoryShopContent.tsx");
    expect(source).toContain('href="/shop/t-shirts"');
    expect(source).toContain('href="/shop/hoodies-sweatshirts"');
    expect(source).not.toContain('href="/shop/sweaters-knitwear"');
  });

  it("loads the above-the-fold PDP image eagerly without the deprecated priority prop", () => {
    const source = read("components/product/ProductDetail.tsx");
    const mainImage = source.split("{activeImageSrc ? (")[1]?.split("<button")[0] ?? "";
    expect(mainImage).toContain('loading="eager"');
    expect(mainImage).toContain('fetchPriority="high"');
    expect(mainImage).toContain("fade={false}");
    expect(mainImage).not.toContain(" priority");
  });

  it("keeps the size guide at the modal layer and contains its scroll", () => {
    const source = read("components/product/SizeGuideModal.tsx");
    expect(source).toContain("z-[300]");
    expect(source).toContain("overscroll-contain overflow-y-auto");
  });
});
