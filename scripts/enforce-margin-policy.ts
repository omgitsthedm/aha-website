import { readFileSync, writeFileSync } from "node:fs";
import type { AhaProduct } from "@/lib/types/product";

const MIN_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35");
const manifestPath = "data/product-manifest.json";
const mapPath = "data/printful-v2-map.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { _generated?: string; products: AhaProduct[] };
const map = JSON.parse(readFileSync(mapPath, "utf8")) as {
  map: Record<string, { costEstimate?: number }>;
};

const quarantined: string[] = [];
let quarantinedVariants = 0;
for (const product of manifest.products) {
  if (product.status !== "active") continue;
  for (const variant of product.variants) {
    if (variant.status !== "active" || !(variant.retailPrice > 0)) continue;
    const cost = map.map[variant.ahaVariantId]?.costEstimate;
    if (cost == null || (variant.retailPrice - cost) / variant.retailPrice < MIN_MARGIN_RATIO) {
      variant.status = "manual_review";
      quarantinedVariants++;
    }
  }
  const hasEligibleVariant = product.variants.some((variant) => variant.status === "active");
  if (!hasEligibleVariant) {
    product.status = "draft";
    quarantined.push(product.slug);
  }
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Margin policy ${Math.round(MIN_MARGIN_RATIO * 100)}%: quarantined ${quarantinedVariants} variant(s) and ${quarantined.length} product(s) with no eligible variant.`);
for (const slug of quarantined) console.log(`  - ${slug}`);
