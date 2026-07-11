// Fails the build if any ACTIVE variant lacks Square mapping (§15).
// Run: npm run validate:square-map
import { loadProducts } from "@/lib/data/products";

const errors: string[] = [];
const seenVariations = new Set<string>();
for (const p of loadProducts()) {
  if (p.status !== "active") continue;
  for (const v of p.variants) {
    if (v.status !== "active") continue;
    if (!v.squareCatalogObjectId) errors.push(`[${p.slug}/${v.sku}] missing squareCatalogObjectId`);
    if (!v.squareVariationId) errors.push(`[${p.slug}/${v.sku}] missing squareVariationId`);
    else if (seenVariations.has(v.squareVariationId)) errors.push(`[${p.slug}/${v.sku}] duplicate squareVariationId ${v.squareVariationId}`);
    else seenVariations.add(v.squareVariationId);
    if (!(v.retailPrice > 0)) errors.push(`[${p.slug}/${v.sku}] missing price mapping`);
    if (!v.currency) errors.push(`[${p.slug}/${v.sku}] missing currency mapping`);
  }
}
if (errors.length) {
  console.error(`✗ validate-square-map: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log("✓ validate-square-map: all active variants mapped to Square");
