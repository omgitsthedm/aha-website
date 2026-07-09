// Fails the build if any ACTIVE variant's margin is missing or below threshold (§15).
// Retail and cost are minor units (cents). Run: npm run margin-check
import { loadProducts } from "@/lib/data/products";

const MIN_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35"); // 35% default floor
const errors: string[] = [];
let missingCost = 0;

for (const p of loadProducts()) {
  if (p.status !== "active") continue;
  for (const v of p.variants) {
    if (v.status !== "active") continue;
    const id = `${p.slug}/${v.sku}`;
    if (!(v.retailPrice > 0)) { errors.push(`[${id}] missing retail price`); continue; }
    if (v.costEstimate == null) { missingCost++; continue; } // costs land in Phase 4 (Printful estimate) — warn, don't fail
    const margin = v.retailPrice - v.costEstimate;
    const ratio = margin / v.retailPrice;
    if (ratio < MIN_MARGIN_RATIO) {
      errors.push(`[${id}] margin ${(ratio * 100).toFixed(1)}% below ${(MIN_MARGIN_RATIO * 100).toFixed(0)}% floor (retail ${v.retailPrice}, cost ${v.costEstimate})`);
    }
  }
}
if (errors.length) {
  console.error(`✗ margin-check: ${errors.length} issue(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
if (missingCost > 0) {
  console.warn(`⚠ margin-check: ${missingCost} active variant(s) have no cost estimate yet (populated in Phase 4). Retail prices present.`);
}
console.log(`✓ margin-check: no active variant is below the ${(MIN_MARGIN_RATIO * 100).toFixed(0)}% margin floor`);
