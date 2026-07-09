// Fails the build if any ACTIVE variant lacks Printful v2 mapping (§15/§24).
// Run: npm run validate:printful-v2-map
import { loadProducts } from "@/lib/data/products";

const errors: string[] = [];
for (const p of loadProducts()) {
  if (p.status !== "active") continue;
  for (const v of p.variants) {
    if (v.status !== "active") continue;
    const id = `${p.slug}/${v.sku}`;
    // printfulCatalogProductId is not required for sync_variant fulfillment.
    if (!v.printfulCatalogVariantId) errors.push(`[${id}] missing printfulCatalogVariantId`);
    if (!v.printfulSyncVariantId && (v.printfulPlacements ?? []).length === 0) {
      errors.push(`[${id}] no fulfillment path (no sync variant and no placements)`);
    }
    const placements = v.printfulPlacements ?? [];
    if (placements.length === 0) errors.push(`[${id}] missing print placement`);
    // Art is served via the sync variant; only require a file when there is no sync variant.
    const hasArt = Boolean(v.printfulSyncVariantId) || placements.some((pl) => pl.fileUrl || pl.fileId);
    if (!hasArt) errors.push(`[${id}] missing print art (sync variant or file)`);
    for (const pl of placements) {
      if (!pl.technique) errors.push(`[${id}] placement "${pl.placement}" missing technique`);
    }
    if ((v.printfulRegionAvailability?.length ?? 0) === 0) errors.push(`[${id}] missing region availability`);
    if (!v.printfulSizeGuideReference) errors.push(`[${id}] missing size-guide reference`);
  }
}
if (errors.length) {
  console.error(`✗ validate-printful-v2-map: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log("✓ validate-printful-v2-map: all active variants mapped to Printful v2 catalog");
