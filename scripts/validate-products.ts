// Fails the build if any ACTIVE product is missing required storefront fields (§15).
// Run: npm run validate:products
import { loadProducts, loadSizeGuides } from "@/lib/data/products";
import { productHasPurchasableVariant } from "@/lib/data/purchasable";

const products = loadProducts();
const sizeGuideIds = new Set(loadSizeGuides().map((g) => g.id));
const errors: string[] = [];

for (const p of products) {
  if (p.status !== "active") continue;
  const need: [string, unknown][] = [
    ["title", p.title], ["slug", p.slug], ["retailPrice", p.retailPrice > 0 || undefined],
    ["currency", p.currency], ["fullDescription", p.fullDescription], ["sizeGuideId", p.sizeGuideId],
    ["fitDescription", p.fitDescription], ["fabricDescription", p.fabricDescription],
    ["careInstructions", p.careInstructions], ["productionNote", p.productionNote],
    ["shippingNote", p.shippingNote], ["returnsNote", p.returnsNote],
    ["featuredImage", p.featuredImage], ["seoTitle", p.seoTitle], ["seoDescription", p.seoDescription],
    ["ogImage", p.ogImage],
  ];
  for (const [field, val] of need) {
    if (!val) errors.push(`[${p.slug || p.ahaProductId}] missing ${field}`);
  }
  if (p.sizeGuideId && !sizeGuideIds.has(p.sizeGuideId)) {
    errors.push(`[${p.slug}] sizeGuideId "${p.sizeGuideId}" not found in size-guides.json`);
  }
  if ((p.collectionIds?.length ?? 0) === 0 && !p.dropId) {
    errors.push(`[${p.slug}] must belong to a collection or drop`);
  }
  if (!p.variants.some((v) => v.status === "active")) {
    errors.push(`[${p.slug}] has no active variant`);
  }
  if (!productHasPurchasableVariant(p)) {
    errors.push(`[${p.slug}] has no fully-purchasable variant`);
  }
}

if (errors.length) {
  console.error(`✗ validate-products: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log(`✓ validate-products: ${products.filter((p) => p.status === "active").length} active product(s) OK`);
