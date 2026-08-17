// Fails the build if an active APLIIQ variant is missing reviewable fulfillment
// evidence. This never calls APLIIQ or Square; it validates only local mapping data.
import { loadProducts } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";

const errors: string[] = [];
const seenSku = new Set<string>();

for (const product of loadProducts()) {
  if (product.status !== "active") continue;
  for (const variant of product.variants) {
    if (variant.status !== "active" || variant.fulfillmentProvider !== "apliiq") continue;
    const id = `${product.slug}/${variant.sku}`;
    if (!variant.apliiqSku) {
      errors.push(`[${id}] missing apliiqSku`);
    } else if (seenSku.has(variant.apliiqSku)) {
      errors.push(`[${id}] duplicate apliiqSku ${variant.apliiqSku}`);
    } else {
      seenSku.add(variant.apliiqSku);
    }

    for (const reason of checkVariantPurchasable(product, variant).reasons) {
      errors.push(`[${id}] ${reason}`);
    }
  }
}

if (errors.length) {
  console.error(`✗ validate-apliiq-map: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

console.log("✓ validate-apliiq-map: all active APLIIQ variants are structurally sale-ready");
