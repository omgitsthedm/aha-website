// Rewrites data/product-manifest.json in place, quarantining any active variant
// that cannot clear the margin floor. APLIIQ variants are judged on LANDED cost
// (product + conservative single-unit freight tier + $1.00 per-product
// fulfillment fee + modelled destination tax + Square fee); legacy Printful
// variants keep the historical product-cost gate. Both route through the one
// shared calculation in lib/commerce/margin.ts.
import { readFileSync, writeFileSync } from "node:fs";
import type { AhaProduct } from "@/lib/types/product";
import { parseApliiqMapDocument, type ApliiqMapEntry } from "@/lib/data/apliiq-map";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";
import { calculateLandedContributionMargin, LEGACY_PRINTFUL_MARGIN_TERMS } from "@/lib/commerce/margin";

const MIN_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35");
const manifestPath = "data/product-manifest.json";
const mapPath = "data/printful-v2-map.json";
const apliiqMapPath = "data/apliiq-map.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { _generated?: string; products: AhaProduct[] };
const map = JSON.parse(readFileSync(mapPath, "utf8")) as {
  map: Record<string, { costEstimate?: number }>;
};
// The APLIIQ registry is authoritative for its variants and the manifest rows
// are provider-neutral, so the landed-cost terms have to be merged in here the
// same way lib/data/products.ts merges them at load.
const apliiqMap: Record<string, ApliiqMapEntry> =
  parseApliiqMapDocument(JSON.parse(readFileSync(apliiqMapPath, "utf8")) as unknown).map;

const quarantined: string[] = [];
let quarantinedVariants = 0;
for (const product of manifest.products) {
  if (product.status !== "active") continue;
  for (const variant of product.variants) {
    if (variant.status !== "active" || !(variant.retailPrice > 0)) continue;
    const apliiq = apliiqMap[variant.ahaVariantId];
    let belowFloor: boolean;
    if (apliiq) {
      const landed = resolveApliiqLandedCost({ ...variant, ...apliiq });
      belowFloor = !landed.ok || landed.landed.margin.contributionMarginRatio < MIN_MARGIN_RATIO;
    } else {
      const cost = map.map[variant.ahaVariantId]?.costEstimate;
      belowFloor = cost == null || calculateLandedContributionMargin({
        retailPrice: variant.retailPrice,
        providerItemCost: cost,
        ...LEGACY_PRINTFUL_MARGIN_TERMS,
      }).contributionMarginRatio < MIN_MARGIN_RATIO;
    }
    if (belowFloor) {
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
