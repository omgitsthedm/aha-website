// Auto-populates data/{product-manifest,square-map,printful-v2-map,size-guides}.json from the
// LIVE Square catalog + Printful v2 sync-products. Read-only against both APIs.
// Join: Printful sync_variant.external_id is the exact Square variation id. No product-name or
// size-string guessing is allowed. Printful sync_variant_id carries the store's configured art.
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
  // 1) Square: all items + variations. Printful's external_id is the exact Square variation id,
  // so mapping never depends on product-name or size-string guesses.
  console.log("→ pulling Square catalog…");
  const squareByVariationId = new Map();
  const squareItems = new Map();
  let cursor = "", sqVariations = 0;
  do {
    const q = `/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ""}`;
    const d = await square(q);
    for (const obj of d.objects || []) {
      const item = obj.item_data || {};
      if (/^(billable hour|discount)$/i.test(item.name || "")) continue; // default Square service items
      const entry = { itemName: item.name, objectId: obj.id };
      squareItems.set(obj.id, entry);
      for (const v of item.variations || []) {
        const vd = v.item_variation_data || {};
        squareByVariationId.set(v.id, {
          ...entry,
          variationId: v.id,
          variationName: vd.name || "OS",
          price: (vd.price_money || {}).amount ?? null,
        });
        sqVariations++;
      }
    }
    cursor = d.cursor || "";
  } while (cursor);
  console.log(`  Square items: ${squareItems.size} (${sqVariations} variations)`);

  // 2) Printful: all sync-products + their sync-variants
  console.log("→ pulling Printful sync-products…");
  const products = new Map(); // Square item id -> { name, variants: Map(Square variation id -> data) }
  // The current production token is scoped to the configured Square-integrated store. Passing an
  // unrelated store id to v2 still returned the same product set, which previously duplicated data.
  for (const storeId of [PF_STORE]) {
  let offset = 0, page;
  do {
    page = await printful(`/sync-products?limit=100&offset=${offset}`, storeId);
    for (const p of page.data || []) {
      const variants = await printful(`/sync-products/${p.id}/sync-variants`, storeId);
      const list = (variants.data || []).filter((v) => !v.is_ignored && v.catalog_variant_id);
      if (!list.length) continue;
      for (const v of list) {
        const sq = squareByVariationId.get(v.external_id);
        const productKey = sq?.objectId || `printful-${storeId}-${p.id}`;
        const entry = products.get(productKey) || {
          key: productKey,
          name: sq?.itemName || p.name,
          printfulProductId: p.id,
          squareObjectId: sq?.objectId,
          variants: new Map(),
        };
        const { color, size } = parseVariant(v.name);
        const sizeKey = (size || "OS").toUpperCase();
        entry.variants.set(sq?.variationId || `${storeId}:${v.id}`, {
          catId: v.catalog_variant_id, syncVariantId: v.id, printfulStoreId: Number(storeId), size: sizeKey, color,
          price: sq?.price ?? Math.round(Number(v.retail_price || 0) * 100),
          squareObjectId: sq?.objectId, squareVariationId: sq?.variationId,
          placements: (v.placements || []).map((pl) => ({
            placement: pl.placement, technique: pl.technique,
          })),
        });
        products.set(productKey, entry);
      }
    }
    offset += 100;
    await sleep(300);
  } while ((page.data || []).length === 100);
  }
  console.log(`  Printful sync-products: ${products.size}`);

  // 3) Compose manifest + maps
  const manifest = [], squareMap = {}, printfulMap = {}, sizeGuides = {};
  let matched = 0, unmatchedVariants = 0;
  const productRows = Array.from(products.values()).map((p) => ({ ...p, variants: Array.from(p.variants.values()) }));
  const slugGroups = new Map();
  for (const p of productRows) {
    const base = slugify(p.name);
    const group = slugGroups.get(base) || [];
    group.push(p);
    slugGroups.set(base, group);
  }
  for (const group of slugGroups.values()) group.sort((a, b) => String(a.key).localeCompare(String(b.key)));

  for (const p of productRows) {
    const type = typeFrom(p.name, p.variants.map((v) => v.size));
    const baseSlug = slugify(p.name);
    const siblings = slugGroups.get(baseSlug);
    const siblingIndex = siblings.indexOf(p);
    const slug = siblingIndex === 0 ? baseSlug : `${baseSlug}-${slugify(String(p.key)).slice(-6)}`;
    const sgId = `sg-${type}`;
    sizeGuides[sgId] ||= { id: sgId, productType: type, fit: fitFor(type), measurements: [], note: "Product-specific measurements pending." };
    const variants = p.variants.map((v, i) => {
      const optionKey = slugify(v.color ? `${v.color}-${v.size}` : v.size) || String(i);
      const vid = `${slug}-${optionKey}-${v.catId || slugify(String(v.squareVariationId)).slice(-6)}`;
      // Fulfillment via sync_variant (store's configured art); catalog files come back empty from the API.
      const fulfillable = Boolean(v.syncVariantId);
      const mapped = Boolean(v.squareVariationId && v.catId && fulfillable);
      if (mapped) matched++; else unmatchedVariants++;
      squareMap[vid] = { squareCatalogObjectId: v.squareObjectId, squareVariationId: v.squareVariationId, squareLocationId: SQUARE_LOCATION };
      const uniquePlacements = Array.from(new Map(v.placements.map((placement) => [
        `${placement.placement}:${placement.technique}`, placement,
      ])).values());
      printfulMap[vid] = { printfulCatalogVariantId: v.catId, printfulSyncVariantId: v.syncVariantId, printfulStoreId: v.printfulStoreId, printfulPlacements: uniquePlacements, printfulRegionAvailability: ["north_america"], printfulSizeGuideReference: sgId };
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
