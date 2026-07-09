// Auto-populates data/{product-manifest,square-map,printful-v2-map,size-guides}.json from the
// LIVE Square catalog + Printful v2 sync-products. Read-only against both APIs.
// Join: normalized product NAME + upper-cased SIZE (catalog_variant_id is a shared blank id, not
// per-design, so it can't be the key). Printful sync_variant_id carries the store's configured art.
//
// Run:  ( set -a; eval "$(netlify env:list --plain 2>/dev/null)"; set +a; node scripts/populate-maps.mjs )
// or pass tokens via env. Tokens are never written to output. See MASTER-BUILD-INSTRUCTION §24.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_VERSION = process.env.SQUARE_API_VERSION || "2024-01-18";
const SQUARE_LOCATION = process.env.SQUARE_LOCATION_ID || "";
const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PF_STORE = process.env.PRINTFUL_STORE_ID;
if (!SQUARE_TOKEN || !PF_TOKEN) {
  console.error("✗ populate-maps: SQUARE_ACCESS_TOKEN and PRINTFUL_API_TOKEN required in env.");
  process.exit(1);
}
const DATA = join(process.cwd(), "data");
const DRY = process.argv.includes("--dry");

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Strip Printful garment/style/color suffixes to recover the clean brand name that Square uses.
const GARMENT = /\s*[-–]?\s*\b(white|black|navy|heather|premium|classic|unisex|men'?s|women'?s|short sleeve|long sleeve|staple|organic|eco|recycled|t-?shirt|tee|shirt|hoodie|sweatshirt|sweater|crewneck|pullover|zip|bubble-free stickers?|kiss-cut stickers?|stickers?|mug|hat|beanie|tote bag|tote|socks?|pin)\b.*$/i;
const normName = (s) => String(s).toLowerCase().replace(GARMENT, "").replace(/[^a-z0-9]+/g, " ").trim();
const parseVariant = (name) => { // "Product / Color / Size" | "Product / Size"
  const parts = String(name).split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { color: parts[parts.length - 2], size: parts[parts.length - 1] };
  if (parts.length === 2) return { color: undefined, size: parts[1] };
  return { color: undefined, size: parts[0] || "OS" };
};

// ── Brand-wide copy defaults (not per-product) ───────────────────────────────
const BRAND = {
  currency: "USD",
  productionNote: "Made to order and printed just for you. Production takes 2–5 business days before shipping.",
  shippingNote: "Free shipping on every order. Delivery includes production time plus carrier transit.",
  returnsNote: "Exchanges and returns on unworn items within 30 days. Misprints and defects are always on us.",
  care: "Machine wash cold, inside out. Tumble dry low. Do not iron the print. Do not dry clean.",
};
const APPAREL_SIZE = /^(xs|s|m|l|xl|2xl|3xl|4xl|5xl|xxl|xxxl)$/i;
const typeFrom = (name, sizes = []) => {
  const n = name.toLowerCase();
  if (/hoodie|zip[ -]?up/.test(n)) return "hoodie";
  if (/sweater|sweatshirt|crewneck|cardigan|pullover/.test(n)) return "sweater";
  if (/mug|hat|beanie|tote|bag|sticker|sock|pin|button|cap|patch/.test(n)) return "accessory";
  if (/tee|shirt|t-shirt/.test(n)) return "tee";
  if (sizes.some((s) => APPAREL_SIZE.test(String(s)))) return "tee"; // has clothing sizes → apparel
  return "accessory"; // no garment word, no clothing sizes → treat as a one-size accessory
};
const fitFor = (t) => t === "hoodie" ? "Relaxed, midweight fleece — true to size." :
  t === "sweater" ? "Relaxed fit, midweight — true to size." :
  t === "tee" ? "Standard unisex fit — true to size." : "One size.";
const fabricFor = (t) => t === "hoodie" ? "Cotton/poly fleece blend." :
  t === "sweater" ? "Cotton-blend knit." : t === "tee" ? "Ringspun cotton." : "Printed to order on premium stock.";

async function square(path) {
  const res = await fetch(`https://connect.squareup.com/v2${path}`, {
    headers: { Authorization: `Bearer ${SQUARE_TOKEN}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Square ${path} ${res.status}`);
  return res.json();
}
// Both Printful stores: the Square-integrated store + the native (API) store used for CLI-created products.
const STORES = Array.from(new Set([PF_STORE, process.env.PRINTFUL_NATIVE_STORE_ID || "697873"].filter(Boolean)));

async function printful(path, storeId = PF_STORE) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.printful.com/v2${path}`, {
      headers: { Authorization: `Bearer ${PF_TOKEN}`, "X-PF-Store-Id": storeId },
    });
    if (res.status === 429) { await sleep(3000); continue; }
    if (!res.ok) throw new Error(`Printful ${path} ${res.status}`);
    return res.json();
  }
  throw new Error(`Printful ${path} rate-limited`);
}

async function main() {
  // 1) Square: all items + variations, indexed by normalized name -> size -> {ids, price}
  console.log("→ pulling Square catalog…");
  const squareByName = new Map(); // normName -> { itemName, objectId, sizes: Map(SIZE -> {variationId, price}) }
  let cursor = "", sqVariations = 0;
  do {
    const q = `/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ""}`;
    const d = await square(q);
    for (const obj of d.objects || []) {
      const item = obj.item_data || {};
      if (/^(billable hour|discount)$/i.test(item.name || "")) continue; // default Square service items
      const key = normName(item.name);
      const entry = squareByName.get(key) || { itemName: item.name, objectId: obj.id, sizes: new Map() };
      for (const v of item.variations || []) {
        const vd = v.item_variation_data || {};
        const size = (vd.name || "OS").trim().toUpperCase();
        entry.sizes.set(size, { variationId: v.id, price: (vd.price_money || {}).amount ?? null });
        sqVariations++;
      }
      squareByName.set(key, entry);
    }
    cursor = d.cursor || "";
  } while (cursor);
  console.log(`  Square items: ${squareByName.size} (${sqVariations} variations)`);

  // 2) Printful: all sync-products + their sync-variants
  console.log("→ pulling Printful sync-products…");
  const products = new Map(); // productName -> { name, variants: [...] }
  for (const storeId of STORES) {
  let offset = 0, page;
  do {
    page = await printful(`/sync-products?limit=100&offset=${offset}`, storeId);
    for (const p of page.data || []) {
      const variants = await printful(`/sync-products/${p.id}/sync-variants`, storeId);
      const list = (variants.data || []).filter((v) => !v.is_ignored && v.catalog_variant_id);
      if (!list.length) continue;
      // Match this Printful product to a Square item by normalized name (exact or prefix).
      const pfKey = normName(p.name);
      let sq = squareByName.get(pfKey);
      if (!sq) { for (const [k, v] of squareByName) { if (pfKey.startsWith(k) || k.startsWith(pfKey)) { sq = v; break; } } }
      const entry = products.get(p.name) || { name: sq?.itemName || p.name, printfulProductId: p.id, squareObjectId: sq?.objectId, variants: [] };
      for (const v of list) {
        const { color, size } = parseVariant(v.name);
        const sizeKey = (size || "OS").toUpperCase();
        const sqSize = sq?.sizes.get(sizeKey);
        entry.variants.push({
          catId: v.catalog_variant_id, syncVariantId: v.id, printfulStoreId: Number(storeId), size: sizeKey, color,
          price: sqSize?.price ?? Math.round(Number(v.retail_price || 0) * 100),
          squareObjectId: sq?.objectId, squareVariationId: sqSize?.variationId,
          placements: (v.placements || []).map((pl) => ({
            placement: pl.placement, technique: pl.technique,
            fileUrl: (pl.layers || pl.files || []).map((l) => l.url).find(Boolean),
            fileId: (pl.layers || pl.files || []).map((l) => l.file_id || l.id).find(Boolean),
          })),
        });
      }
      products.set(p.name, entry);
    }
    offset += 100;
    await sleep(300);
  } while ((page.data || []).length === 100);
  }
  console.log(`  Printful sync-products: ${products.size}`);

  // 3) Compose manifest + maps
  const manifest = [], squareMap = {}, printfulMap = {}, sizeGuides = {};
  let matched = 0, unmatchedVariants = 0;
  for (const p of products.values()) {
    const type = typeFrom(p.name, p.variants.map((v) => v.size));
    const slug = slugify(p.name);
    const sgId = `sg-${type}`;
    sizeGuides[sgId] ||= { id: sgId, productType: type, fit: fitFor(type), measurements: [], note: "Product-specific measurements pending." };
    const variants = p.variants.map((v, i) => {
      const vid = `${slug}-${slugify(v.color ? v.color + "-" + v.size : v.size) || i}`;
      // Fulfillment via sync_variant (store's configured art); catalog files come back empty from the API.
      const fulfillable = Boolean(v.syncVariantId);
      const mapped = Boolean(v.squareVariationId && v.catId && fulfillable);
      if (mapped) matched++; else unmatchedVariants++;
      squareMap[vid] = { squareCatalogObjectId: v.squareObjectId, squareVariationId: v.squareVariationId, squareLocationId: SQUARE_LOCATION };
      printfulMap[vid] = { printfulCatalogVariantId: v.catId, printfulSyncVariantId: v.syncVariantId, printfulStoreId: v.printfulStoreId, printfulPlacements: v.placements, printfulRegionAvailability: ["north_america"], printfulSizeGuideReference: sgId };
      return {
        ahaVariantId: vid, ahaProductId: slug, sku: `${slug}-${v.catId}`, size: v.size || "OS",
        color: v.color || undefined,
        retailPrice: v.price || 0, currency: BRAND.currency, status: mapped && v.price ? "active" : "manual_review",
        printfulSource: "catalog", sortOrder: i,
      };
    });
    const priced = variants.find((v) => v.retailPrice > 0);
    const allMapped = variants.length > 0 && variants.every((v) => v.status === "active");
    manifest.push({
      ahaProductId: slug, slug, title: p.name, shortDescription: p.name,
      fullDescription: `${p.name} by After Hours Agenda. Printed to order.`,
      productType: type, collectionIds: [type === "other" ? "shop-all" : `${type}s`],
      status: allMapped ? "active" : "draft",
      retailPrice: priced?.retailPrice || 0, currency: BRAND.currency,
      fitDescription: fitFor(type), fabricDescription: fabricFor(type), printMethod: "DTG/DTF",
      careInstructions: BRAND.care, productionNote: BRAND.productionNote,
      shippingNote: BRAND.shippingNote, returnsNote: BRAND.returnsNote, sizeGuideId: sgId,
      featuredImage: `/products/${slug}.webp`, galleryImages: [],
      seoTitle: `${p.name} — After Hours Agenda`, seoDescription: `${p.name}. NYC streetwear, printed to order. Free shipping.`,
      ogImage: `/products/${slug}.webp`, badges: [], sortPriority: 0, variants,
    });
  }

  const summary = {
    products: manifest.length, active: manifest.filter((p) => p.status === "active").length,
    draft: manifest.filter((p) => p.status === "draft").length,
    variantsMatched: matched, variantsNeedingReview: unmatchedVariants,
  };
  console.log("→ summary:", JSON.stringify(summary));

  if (DRY) { console.log("(dry run — no files written)"); return; }
  writeFileSync(join(DATA, "product-manifest.json"), JSON.stringify({ _generated: "populate-maps.mjs", products: manifest }, null, 2));
  writeFileSync(join(DATA, "square-map.json"), JSON.stringify({ map: squareMap }, null, 2));
  writeFileSync(join(DATA, "printful-v2-map.json"), JSON.stringify({ map: printfulMap }, null, 2));
  writeFileSync(join(DATA, "size-guides.json"), JSON.stringify({ sizeGuides: Object.values(sizeGuides) }, null, 2));
  console.log("✓ wrote data/product-manifest.json + square-map + printful-v2-map + size-guides");
}

main().catch((e) => { console.error("✗ populate-maps failed:", e.message); process.exit(1); });
