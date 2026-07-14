// On-model photography via Printful mockup styles — REAL photographed models
// wearing the blank, with our print composited. No synthetic humans.
//
// Run: PRINTFUL_API_TOKEN=... node scripts/generate-onmodel-shots.mjs
// Writes JPGs to a temp list on stdout (downloading/webp handled by caller).
import { readFileSync } from "node:fs";

const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PF_STORE = process.env.PRINTFUL_STORE_ID || "14298228";
const SITE = process.env.SITE_URL || "https://afterhoursagenda.com";
if (!PF_TOKEN) { console.error("PRINTFUL_API_TOKEN required"); process.exit(1); }

// slug → shot request. style is matched by category+view from the blank's
// live style library, art comes from the product's own print files.
const SHOTS = [
  { out: "hero-home", slug: "black-sheep-unisex-premium-sweatshirt", category: "Women's Lifestyle", view: "Front" },
  { out: "hero-men", slug: "classic-black-unisex-hoodie", category: "Men's", view: "Front" },
  { out: "hero-women", slug: "hope-tomorrow-pink-unisex-premium-sweatshirt", category: "Women's", view: "Front" },
  { out: "hero-unisex", slug: "no-place-like-new-york-charcoal-unisex-premium-sweatshirt", category: "Men's", view: "Left Front" },
];

const manifest = JSON.parse(readFileSync("data/product-manifest.json", "utf8"));
const pfMap = JSON.parse(readFileSync("data/printful-v2-map.json", "utf8")).map;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pf(path, method = "GET", body) {
  const res = await fetch(`https://api.printful.com/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${PF_TOKEN}`, "X-PF-Store-Id": PF_STORE, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PF ${method} ${path} ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

async function artUrlFor(slug, product, entry) {
  const withUrl = (entry.printfulPlacements || []).find((p) => p.fileUrl && !p.placement.startsWith("label"));
  if (withUrl) return { url: withUrl.fileUrl, placement: withUrl.placement, technique: withUrl.technique };
  // sync-fulfilled: the RAW print file lives on the sync variant. (The local
  // printful-assets exports are product images — printing those onto a
  // garment makes an inception mockup.) v1 preview_url is public.
  if (entry.printfulSyncVariantId) {
    const res = await fetch(`https://api.printful.com/sync/variant/${entry.printfulSyncVariantId}`, {
      headers: { Authorization: `Bearer ${PF_TOKEN}`, "X-PF-Store-Id": PF_STORE },
    });
    const json = await res.json();
    const files = json.result?.sync_variant?.files || [];
    const file = files.find((f) => ["default", "front"].includes(f.type) && f.preview_url);
    if (file) {
      const pl = (entry.printfulPlacements || []).find((x) => !x.placement.startsWith("label")) || (entry.printfulPlacements || [])[0];
      return { url: file.preview_url, placement: pl?.placement || "front", technique: pl?.technique || "dtg" };
    }
  }
  throw new Error(`no print art for ${slug}`);
}

const results = {};
for (const shot of SHOTS) {
  try {
  const product = manifest.products.find((p) => p.slug === shot.slug);
  const entry = pfMap[product.variants.find((v) => v.status === "active").ahaVariantId];
  const variantId = entry.printfulCatalogVariantId;
  const detail = await pf(`/catalog-variants/${variantId}`);
  const productId = detail.data.catalog_product_id;
  const art = await artUrlFor(shot.slug, product, entry);

  const styles = await pf(`/catalog-products/${productId}/mockup-styles?placements=${art.placement}`);
  let styleId = null;
  for (const g of styles.data || []) {
    for (const st of g.mockup_styles || []) {
      if (st.category_name === shot.category && st.view_name === shot.view) styleId = st.id;
    }
  }
  if (!styleId) { console.error(`✗ ${shot.out}: no style ${shot.category}/${shot.view} on product ${productId}`); continue; }

  const task = await pf("/mockup-tasks", "POST", {
    format: "jpg",
    products: [{
      source: "catalog",
      catalog_product_id: productId,
      catalog_variant_ids: [variantId],
      mockup_style_ids: [styleId],
      placements: [{ placement: art.placement, technique: art.technique, layers: [{ type: "file", url: art.url }] }],
    }],
  });
  const taskId = task.data?.[0]?.id;
  let url = null;
  for (let i = 0; i < 20 && taskId; i++) {
    await sleep(3000);
    const res = await pf(`/mockup-tasks?id=${taskId}`);
    const t = res.data?.[0];
    if (t?.status === "completed") {
      url = t.catalog_variant_mockups?.[0]?.mockups?.[0]?.mockup_url ?? null;
      break;
    }
    if (t?.status === "failed") { console.error(`✗ ${shot.out}: task failed ${JSON.stringify(t.failure_reasons || t).slice(0, 150)}`); break; }
  }
  if (url) { results[shot.out] = url; console.error(`✓ ${shot.out}: ${shot.category}/${shot.view}`); }
  } catch (error) {
    console.error(`✗ ${shot.out}: ${error.message.slice(0, 180)}`);
  }
  await sleep(500);
}
console.log(JSON.stringify(results));
