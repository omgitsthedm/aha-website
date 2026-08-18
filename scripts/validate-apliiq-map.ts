// Fails the build if an active APLIIQ variant is missing reviewable fulfillment
// evidence. This never calls APLIIQ or Square; it validates only local mapping data.
import { loadApliiqMap, loadProducts } from "@/lib/data/products";
import { APLIIQ_CATALOG_POLICY } from "@/lib/commerce/catalog-policy";
import { checkVariantPurchasable } from "@/lib/data/purchasable";

const errors: string[] = [];
const seenSku = new Set<string>();
const map = loadApliiqMap();
const knownVariantIds = new Set(loadProducts().flatMap((product) => product.variants.map((variant) => variant.ahaVariantId)));

for (const variantId of Object.keys(map)) {
  if (!knownVariantIds.has(variantId)) errors.push(`[${variantId}] APLIIQ map entry has no matching manifest variant`);
}

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

/**
 * THE MONEY GUARD.
 *
 * Checkout being open is a promise that every sellable variant can actually be
 * fulfilled. While the capsule runs on placeholder APQ SKUs that promise is
 * false: with APLIIQ_ALLOW_CREATE_ORDERS=false the card is CAPTURED and the
 * order is held, never sent — money in, nothing made.
 *
 * So the unsafe combination is refused at build time rather than left to
 * whoever next edits catalog-policy.ts. Opening checkout with an unverified SKU
 * anywhere stops the build with the list of offenders.
 *
 * apliiqSkuVerified is set by the add-to-store callback when APLIIQ confirms a
 * real product, or by hand once the SKU is copied off the APLIIQ dashboard.
 */
if (APLIIQ_CATALOG_POLICY.checkoutEnabled) {
  const unverified: string[] = [];
  for (const product of loadProducts()) {
    for (const variant of product.variants) {
      if (variant.fulfillmentProvider !== "apliiq") continue;
      if (!checkVariantPurchasable(product, variant).ok) continue;
      if (variant.apliiqSkuVerified !== true) {
        unverified.push(`${product.slug}/${variant.sku} (${variant.apliiqSku})`);
      }
    }
  }
  if (unverified.length) {
    console.error(
      `✗ validate-apliiq-map: checkout is ENABLED but ${unverified.length} sellable variant(s) still carry an unverified APLIIQ SKU.\n` +
      `  With APLIIQ_ALLOW_CREATE_ORDERS=false a paid order is captured and held, never sent — the customer is charged for a garment that cannot be made.\n` +
      `  Either set APLIIQ_CATALOG_POLICY.checkoutEnabled = false, or replace these with real APQ SKUs and mark apliiqSkuVerified: true.\n` +
      `  - ${unverified.slice(0, 20).join("\n  - ")}` +
      (unverified.length > 20 ? `\n  ...and ${unverified.length - 20} more` : "")
    );
    process.exit(1);
  }
}

if (errors.length) {
  console.error(`✗ validate-apliiq-map: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

console.log("✓ validate-apliiq-map: all active APLIIQ variants are structurally sale-ready");
