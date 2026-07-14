// Sheep product rebuild, step 3 of 3: generate Printful mockups for the
// rebuilt (imageless) Square items and attach them via
// /api/ops/catalog-rebuild?action=attach. The storefront hides items with
// no Square image, so the rebuilt products stay invisible until this runs.
//
// Run: OPS_MAINTENANCE_KEY=... PRINTFUL_API_TOKEN=... node scripts/attach-rebuild-mockups.mjs [--live]
import { readFileSync } from "node:fs";

const LIVE = process.argv.includes("--live");
const SITE = process.env.SITE_URL || "https://afterhoursagenda.com";
const OPS_KEY = process.env.OPS_MAINTENANCE_KEY;
const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PF_STORE = process.env.PRINTFUL_STORE_ID || "14298228";
if (!OPS_KEY || !PF_TOKEN) { console.error("OPS_MAINTENANCE_KEY and PRINTFUL_API_TOKEN required"); process.exit(1); }

// slug → placement to render for the primary mockup (matches rebuild ART_PLAN;
// art URL + technique come from the printful-v2 map so they can never drift).
const MOCKUP_PLAN = {
  "black-sheep-bone-unisex-premium-sweatshirt": "front",
  "black-sheep-mint-unisex-premium-sweatshirt": "front",
  "black-sheep-unisex-premium-sweatshirt": "front_large",
  "black-sheep-can-cooler": "front",
  "counting-sheep-tote-bag-regular": "default",
  "counting-sheep-tote-bag-large-with-pocket": "default",
  "counting-sheep-crossbody-bag": "front",
};

const manifestDoc = JSON.parse(readFileSync("data/product-manifest.json", "utf8"));
const squareMap = JSON.parse(readFileSync("data/square-map.json", "utf8")).map;
const pfMap = JSON.parse(readFileSync("data/printful-v2-map.json", "utf8")).map;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pf(path, method = "GET", body) {
  const res = await fetch(`https://api.printful.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PF_TOKEN}`,
      "X-PF-Store-Id": PF_STORE,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PF ${method} ${path} ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

for (const [slug, mockPlacement] of Object.entries(MOCKUP_PLAN)) {
  const product = manifestDoc.products.find((p) => p.slug === slug);
  if (!product) { console.log(`skip ${slug}: not in manifest`); continue; }
  const activeVariants = product.variants.filter((v) => v.status === "active");
  const keys = activeVariants.map((v) => v.ahaVariantId);
  const itemId = keys.map((k) => squareMap[k]?.squareCatalogObjectId).find(Boolean);
  const pfEntries = keys.map((k) => pfMap[k]).filter(Boolean);
  const variantIds = pfEntries.map((e) => e.printfulCatalogVariantId).filter(Boolean);
  const placementSpec = pfEntries[0]?.printfulPlacements?.find((p) => p.placement === mockPlacement);
  if (!itemId || variantIds.length === 0 || !placementSpec?.fileUrl) {
    console.log(`skip ${slug}: itemId=${itemId} variants=${variantIds.length} placement=${Boolean(placementSpec?.fileUrl)}`);
    continue;
  }

  // catalog product id from the first variant's detail
  const detail = await pf(`/catalog-variants/${variantIds[0]}`);
  const productId = detail.data?.catalog_product_id;
  if (!productId) { console.log(`skip ${slug}: no catalog_product_id`); continue; }

  console.log(`\n${slug} → item ${itemId}, catalog product ${productId}, ${variantIds.length} variant(s), ${mockPlacement}/${placementSpec.technique}`);
  if (!LIVE) continue;

  // One task per variant: mixed variants can disagree on available mockup
  // styles (can cooler regular vs slim). Cut-sew products require the
  // stitch_color option.
  const productOptions = placementSpec.technique === "cut-sew"
    ? [{ name: "stitch_color", value: "black" }]
    : undefined;
  let mockups = [];
  for (const variantId of variantIds.slice(0, 4)) {
    try {
      const task = await pf("/mockup-tasks", "POST", {
        format: "jpg",
        products: [{
          source: "catalog",
          catalog_product_id: productId,
          catalog_variant_ids: [variantId],
          placements: [{ placement: mockPlacement, technique: placementSpec.technique, layers: [{ type: "file", url: placementSpec.fileUrl }] }],
          ...(productOptions ? { product_options: productOptions } : {}),
        }],
      });
      const taskIds = (task.data || []).map((t) => t.id).filter(Boolean);
      for (let i = 0; i < 20 && taskIds.length; i++) {
        await sleep(3000);
        const res = await pf(`/mockup-tasks?id=${taskIds.join(",")}`);
        const all = res.data || [];
        if (all.every((t) => t.status === "completed" || t.status === "failed")) {
          mockups.push(...all.flatMap((t) => (t.catalog_variant_mockups || []).flatMap((m) =>
            (m.mockups || []).map((mm) => mm.mockup_url))));
          break;
        }
      }
      if (mockups.length >= 2) break; // primary + one alt is plenty
    } catch (error) {
      console.warn(`  ⚠ mockups failed for variant ${variantId}: ${error.message.slice(0, 200)}`);
    }
  }
  const urls = [...new Set(mockups)].slice(0, 4);
  if (urls.length === 0) { console.warn(`  ⚠ no mockups — item stays hidden`); continue; }
  console.log(`  ${urls.length} mockup(s)`);

  const res = await fetch(`${SITE}/api/ops/catalog-rebuild?action=attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-maintenance-key": OPS_KEY },
    body: JSON.stringify({ itemId, name: product.title || slug, imageUrls: urls }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(`  attach: ${json.ok ? `ok (${json.imageIds?.length} image(s))` : JSON.stringify(json).slice(0, 200)}`);
}

console.log(LIVE ? "\nDone. Verify the products render on /shop." : "\nDRY RUN complete. Re-run with --live.");
