// Provider liveness audit — catches silent fulfillment landmines BEFORE a
// customer does. For every ACTIVE variant it verifies against live Printful:
//   1. the mapped sync variant still exists and is not ignored
//   2. the mapped catalog variant still exists (discontinued blanks 404)
//   3. catalog-source variants have a complete placements+art path
//   4. a cost estimate is present for the margin gate
//
// Run:  PRINTFUL_API_TOKEN=... npm run audit:provider-liveness
// Read-only. Exits 1 when anything needs attention (quarantine the findings
// with a manifest status flip, then re-run validate:all).
//
// 2026-07-13: this audit caught Printful discontinuing the Lightweight Zip
// Hoodie blank while classic-aha and splatter were still live and sellable.
import { readFileSync } from "node:fs";

const TOKEN = process.env.PRINTFUL_API_TOKEN;
const STORE = process.env.PRINTFUL_STORE_ID || "14298228";
if (!TOKEN) { console.error("✗ PRINTFUL_API_TOKEN required"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pf(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.printful.com/v2${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, "X-PF-Store-Id": STORE },
    });
    if (res.status === 429) { await sleep(2500 * (attempt + 1)); continue; }
    if (res.status === 404) return { __missing: true };
    if (!res.ok) throw new Error(`printful ${path} -> ${res.status}`);
    return res.json();
  }
  throw new Error(`printful ${path}: rate-limited`);
}

const manifest = JSON.parse(readFileSync("data/product-manifest.json", "utf8")).products;
const pfMap = JSON.parse(readFileSync("data/printful-v2-map.json", "utf8")).map;

console.log("→ pulling live sync variants…");
const liveSync = new Map();
let offset = 0, page;
do {
  page = await pf(`/sync-products?limit=100&offset=${offset}`);
  for (const product of page.data || []) {
    const variants = await pf(`/sync-products/${product.id}/sync-variants`);
    for (const variant of variants.data || []) {
      liveSync.set(variant.id, { ignored: variant.is_ignored, catalogVariantId: variant.catalog_variant_id });
    }
    await sleep(150);
  }
  offset += 100;
} while ((page.data || []).length === 100);

const issues = [];
const catalogIds = new Set();
let audited = 0;
for (const product of manifest) {
  if (product.status !== "active") continue;
  for (const variant of product.variants) {
    if (variant.status !== "active") continue;
    audited++;
    const id = `${product.slug}/${variant.size}${variant.color ? ` ${variant.color}` : ""}`;
    const entry = pfMap[variant.ahaVariantId];
    if (!entry) { issues.push(`NO-MAP ${id}`); continue; }
    if (entry.printfulSyncVariantId) {
      const live = liveSync.get(entry.printfulSyncVariantId);
      if (!live) issues.push(`GHOST-SYNC ${id} sync=${entry.printfulSyncVariantId}`);
      else if (live.ignored) issues.push(`IGNORED-SYNC ${id}`);
      else if (live.catalogVariantId !== entry.printfulCatalogVariantId) issues.push(`CAT-MISMATCH ${id}`);
    } else {
      const placements = entry.printfulPlacements || [];
      if (!placements.length || !placements.every((p) => p.fileUrl)) issues.push(`NO-FULFILL-PATH ${id}`);
    }
    if (!entry.costEstimate) issues.push(`NO-COST ${id}`);
    if (entry.printfulCatalogVariantId) catalogIds.add(entry.printfulCatalogVariantId);
  }
}

console.log(`→ checking ${catalogIds.size} catalog variants for discontinued blanks…`);
for (const catalogId of Array.from(catalogIds).sort((a, b) => a - b)) {
  const res = await pf(`/catalog-variants/${catalogId}`);
  if (res.__missing) {
    const owners = [];
    for (const product of manifest) {
      for (const variant of product.variants) {
        if (variant.status === "active" && pfMap[variant.ahaVariantId]?.printfulCatalogVariantId === catalogId) {
          owners.push(`${product.slug}/${variant.size}${variant.color ? ` ${variant.color}` : ""}`);
        }
      }
    }
    issues.push(`DISCONTINUED cat=${catalogId} → ${owners.join(", ")}`);
  }
  await sleep(120);
}

console.log(`\naudited ${audited} active variants; live sync variants: ${liveSync.size}`);
if (issues.length) {
  console.error(`✗ audit:provider-liveness — ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}
console.log("✓ audit:provider-liveness — every active variant is fulfillable");
