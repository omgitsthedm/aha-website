// Sheep rebuild follow-up: the snapshot print positions were tuned to the OLD
// art files. The clean art has different aspect ratios, and Printful enforces
// (a) position box fits inside the print area and (b) position ratio matches
// the file ratio within 2%. This recomputes every position for the rebuilt
// products from the real print areas + real file dimensions, then verifies
// each product with a v2 draft order (created and immediately deleted).
//
// Run: PRINTFUL_API_TOKEN=... node scripts/fix-rebuild-positions.mjs [--live] [--verify]
import { readFileSync, writeFileSync } from "node:fs";

const LIVE = process.argv.includes("--live");
const VERIFY = process.argv.includes("--verify");
const SITE = process.env.SITE_URL || "https://afterhoursagenda.com";
const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PF_STORE = process.env.PRINTFUL_STORE_ID || "14298228";
if (!PF_TOKEN) { console.error("PRINTFUL_API_TOKEN required"); process.exit(1); }

// label_inside now prints the wordmark strip authored at the label ratio
const LABEL_STRIP = `${SITE}/printful-assets/Black_Sheep_CLEAN_Label_Strip.png`;

const SLUGS = [
  "black-sheep-bone-unisex-premium-sweatshirt",
  "black-sheep-mint-unisex-premium-sweatshirt",
  "black-sheep-unisex-premium-sweatshirt",
  "black-sheep-can-cooler",
  "counting-sheep-tote-bag-regular",
  "counting-sheep-tote-bag-large-with-pocket",
  "counting-sheep-crossbody-bag",
];

const manifestDoc = JSON.parse(readFileSync("data/product-manifest.json", "utf8"));
const pfDoc = JSON.parse(readFileSync("data/printful-v2-map.json", "utf8"));
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
  if (!res.ok) { const e = new Error(`PF ${method} ${path} ${res.status}: ${JSON.stringify(json).slice(0, 250)}`); e.body = json; throw e; }
  return json;
}

const ratioCache = new Map();
async function fileRatio(url) {
  if (ratioCache.has(url)) return ratioCache.get(url);
  const res = await fetch(url, { headers: { Range: "bytes=0-32" } });
  const buf = Buffer.from(await res.arrayBuffer());
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const r = width / height;
  ratioCache.set(url, r);
  return r;
}

const areaCache = new Map();
async function printArea(productId, placement) {
  const key = `${productId}:${placement}`;
  if (areaCache.has(key)) return areaCache.get(key);
  const res = await pf(`/catalog-products/${productId}/mockup-styles?placements=${placement}`);
  // multiple styles can report different areas; the largest is the true area
  let best = null;
  for (const g of res.data || []) {
    if (g.placement !== placement || !g.print_area_width) continue;
    if (!best || g.print_area_width * g.print_area_height > best.w * best.h) {
      best = { w: g.print_area_width, h: g.print_area_height };
    }
  }
  areaCache.set(key, best);
  return best;
}

const round = (n) => Math.round(n * 10000) / 10000;

/** Largest ratio-true box inside the area; horizontally centered, near the top. */
function fitPosition(area, ratio) {
  let width = area.w;
  let height = width / ratio;
  if (height > area.h) { height = area.h; width = height * ratio; }
  const left = round((area.w - width) / 2);
  const top = round(Math.min(1, area.h - height));
  return { width: round(width), height: round(height), top, left };
}

for (const slug of SLUGS) {
  const product = manifestDoc.products.find((p) => p.slug === slug);
  if (!product) { console.log(`skip ${slug}`); continue; }
  console.log(`\n${slug}`);

  let productId = null;
  for (const mv of product.variants) {
    const entry = pfDoc.map[mv.ahaVariantId];
    if (!entry) continue;
    if (!productId) {
      const detail = await pf(`/catalog-variants/${entry.printfulCatalogVariantId}`);
      productId = detail.data?.catalog_product_id;
    }
    for (const pl of entry.printfulPlacements) {
      if (pl.placement === "label_inside") pl.fileUrl = LABEL_STRIP;
      const area = await printArea(productId, pl.placement);
      if (!area) { delete pl.position; continue; } // no reported area → let Printful auto-fit
      const ratio = await fileRatio(pl.fileUrl);
      const next = fitPosition(area, ratio);
      pl.position = next;
    }
  }
  const first = pfDoc.map[product.variants[0].ahaVariantId];
  for (const pl of first.printfulPlacements) {
    console.log(`  ${pl.placement}: ${JSON.stringify(pl.position) || "auto"}`);
  }

  if (VERIFY) {
    const entry = first;
    const placements = entry.printfulPlacements.map((pl) => ({
      placement: pl.placement, technique: pl.technique,
      layers: [{ type: "file", url: pl.fileUrl, ...(pl.position ? { position: pl.position } : {}) }],
    }));
    try {
      const draft = await pf("/orders", "POST", {
        recipient: { name: "Draft Verification", address1: "19749 Dearborn St", city: "Chatsworth", state_code: "CA", country_code: "US", zip: "91311" },
        order_items: [{ source: "catalog", catalog_variant_id: entry.printfulCatalogVariantId, quantity: 1, placements }],
      });
      const id = draft.data?.id;
      console.log(`  ✓ draft ${id} accepted`);
      if (id) await pf(`/orders/${id}`, "DELETE").catch(() => {});
    } catch (error) {
      console.log(`  ✗ draft rejected: ${error.message.slice(0, 220)}`);
    }
    await sleep(400);
  }
}

if (LIVE) {
  writeFileSync("data/printful-v2-map.json", `${JSON.stringify(pfDoc, null, 1)}\n`);
  console.log("\nmap written.");
} else {
  console.log("\nDRY RUN — re-run with --live to write the map.");
}
