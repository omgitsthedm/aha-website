// Sheep product rebuild, step 2 of 2 (after /api/ops/catalog-rebuild?action=delete).
// For each product in data/sheep-rebuild-snapshot.json:
//   1. builds the NEW-design placements (clean art URLs, original print positions)
//   2. creates a fresh Square item via /api/ops/catalog-create (same title/price)
//   3. rewrites manifest + square-map + printful-v2-map for catalog-source
//      fulfillment (no Printful store product — the factory architecture)
//   4. syncs costs, generates clean mockups, validates
//
// Run:  OPS_MAINTENANCE_KEY=... PRINTFUL_API_TOKEN=... node scripts/rebuild-sheep-products.mjs [--live]
// Dry run prints the plan. Requires the site deployed with catalog-create live.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const LIVE = process.argv.includes("--live");
const SITE = process.env.SITE_URL || "https://afterhoursagenda.com";
const OPS_KEY = process.env.OPS_MAINTENANCE_KEY;
const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PF_STORE = process.env.PRINTFUL_STORE_ID || "14298228";

const ART = {
  solo: `${SITE}/printful-assets/Black_Sheep_CLEAN_Print_Front.png`,
  pattern: `${SITE}/printful-assets/Black_Sheep_CLEAN_Pattern_Tile.png`,
  label: `${SITE}/printful-assets/Black_Sheep_CLEAN_Label_Inside.png`,
};

// which art goes on which placement, per product
const ART_PLAN = {
  "black-sheep-bone-unisex-premium-sweatshirt": { front: "solo", label_inside: "label" },
  "black-sheep-mint-unisex-premium-sweatshirt": { front: "solo", label_inside: "label" },
  "black-sheep-unisex-premium-sweatshirt": { front_large: "solo", label_inside: "label" },
  "black-sheep-can-cooler": { front: "pattern", back: "pattern" },
  "counting-sheep-tote-bag-regular": { default: "pattern" },
  "counting-sheep-tote-bag-large-with-pocket": { default: "pattern", pocket: "pattern" },
  "counting-sheep-crossbody-bag": { front: "pattern", back: "pattern", label_inside: "label" },
  // socks are embroidery — replaced by black-sheep-embroidered-crew-socks (factory spec):
  // "black-sheep-black-grey-or-white-comfy-socks": { embroidery_outside_left: "solo" },
};

const snapshot = JSON.parse(readFileSync("data/sheep-rebuild-snapshot.json", "utf8"));
const manifestDoc = JSON.parse(readFileSync("data/product-manifest.json", "utf8"));
const squareMapDoc = JSON.parse(readFileSync("data/square-map.json", "utf8"));
const pfMapDoc = JSON.parse(readFileSync("data/printful-v2-map.json", "utf8"));

async function createSquareItem(body) {
  const res = await fetch(`${SITE}/api/ops/catalog-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-maintenance-key": OPS_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(`Square create failed: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

for (const [slug, artMap] of Object.entries(ART_PLAN)) {
  const snap = snapshot[slug];
  const product = manifestDoc.products.find((p) => p.slug === slug);
  if (!snap || !product) { console.log(`skip ${slug}: missing snapshot or manifest`); continue; }

  // placements per variant from the snapshot, art swapped to the clean files
  const variantPlans = product.variants.map((mv) => {
    const size = String(mv.size).toUpperCase();
    const sv = snap.variants.find((v) => (v.name.split("/").pop() || "").trim().toUpperCase() === size) || snap.variants[0];
    const placements = [];
    for (const pl of sv.placements) {
      const key = pl.placement;
      if (!(key in artMap)) continue; // drop placements we are not re-arting
      if (placements.some((x) => x.placement === key)) continue; // dedupe
      placements.push({
        placement: key,
        technique: pl.technique,
        fileUrl: ART[artMap[key]],
        ...(pl.position ? { position: pl.position } : {}),
      });
    }
    return { manifestVariant: mv, catalogVariantId: sv.catalogVariantId, placements };
  });

  console.log(`\n${slug} — ${variantPlans.length} variants @ $${(product.retailPrice / 100).toFixed(2)}`);
  for (const vp of variantPlans.slice(0, 2)) console.log("  ", vp.manifestVariant.size, "cat", vp.catalogVariantId, vp.placements.map((p) => `${p.placement}<-${p.fileUrl.split("_").pop()}`).join(" "));

  if (!LIVE) continue;

  const square = await createSquareItem({
    name: snap.title,
    description: `${snap.title} by After Hours Agenda. Printed to order.`,
    variations: variantPlans.map((vp) => ({ name: String(vp.manifestVariant.size), priceCents: product.retailPrice, sku: vp.manifestVariant.sku })),
    imageUrls: [],
    allowDuplicateName: false,
  });
  console.log("  square item:", square.itemId);

  const now = new Date().toISOString();
  for (const vp of variantPlans) {
    const mv = vp.manifestVariant;
    const sqVarId = square.variationIds[String(mv.size)];
    if (!sqVarId) throw new Error(`no square variation for ${slug}/${mv.size}`);
    squareMapDoc.map[mv.ahaVariantId] = { squareCatalogObjectId: square.itemId, squareVariationId: sqVarId, squareLocationId: "FGKRPYEXNV482" };
    const prev = pfMapDoc.map[mv.ahaVariantId] || {};
    pfMapDoc.map[mv.ahaVariantId] = {
      printfulCatalogVariantId: vp.catalogVariantId,
      printfulStoreId: Number(PF_STORE),
      printfulPlacements: vp.placements,
      printfulRegionAvailability: ["north_america"],
      printfulSizeGuideReference: product.sizeGuideId,
      costEstimate: prev.costEstimate, costCurrency: prev.costCurrency, costVerifiedAt: now,
    };
    // no printfulSyncVariantId: fulfillment is catalog-source with the clean art
    mv.status = "active";
  }
  if (product.variants.every((v) => v.status === "active")) product.status = "active";
}

if (LIVE) {
  writeFileSync("data/product-manifest.json", `${JSON.stringify(manifestDoc, null, 2)}\n`);
  writeFileSync("data/square-map.json", `${JSON.stringify(squareMapDoc, null, 1)}\n`);
  writeFileSync("data/printful-v2-map.json", `${JSON.stringify(pfMapDoc, null, 1)}\n`);
  console.log("\ndata files written — now run: sync:printful-costs, validate:all, regenerate mockups, commit, deploy");
} else {
  console.log("\nDRY RUN complete. Re-run with --live after the delete endpoint has run.");
}
