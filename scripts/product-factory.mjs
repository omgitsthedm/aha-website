// Product Factory — design in, live product out. No Printful dashboard.
//
// Fulfillment uses Printful v2 catalog-source order items (blank + hosted art),
// verified against this store 2026-07-13, so no Printful store product is
// needed. Square carries checkout; the manifest + maps carry fulfillment.
//
// Modes:
//   npm run product-factory -- --spec design.json [--live] [--verify-draft] [--push]
//   npm run product-factory -- --resurrect <slug> --price 4600 [--live] ...
//
// Spec (new product):
// {
//   "name": "Midnight Runners Tee",
//   "artUrl": "https://afterhoursagenda.com/printful-assets/Midnight_Runners.png",
//   "garmentCatalogProductId": 786,          // Printful catalog product (the blank)
//   "colors": ["Black", "Pepper"],           // catalog color names, or omit for all
//   "sizes": ["S","M","L","XL","2XL"],       // or omit for all available
//   "placement": "front", "technique": "dtg",
//   "position": { "width": 12, "height": 13.87, "top": 1.07, "left": 0 },  // optional
//   "retailPrice": 4000,                      // cents; omit for auto (35% floor + $1, whole dollar)
//   "productType": "tee", "collectionIds": ["tees"]
// }
//
// Env: PRINTFUL_API_TOKEN, PRINTFUL_STORE_ID (default 14298228),
//      OPS_MAINTENANCE_KEY (for the production Square-create endpoint),
//      SITE_URL (default https://afterhoursagenda.com)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const LIVE = flag("live");
const VERIFY_DRAFT = flag("verify-draft");
const PUSH = flag("push");
const SITE = process.env.SITE_URL || "https://afterhoursagenda.com";
const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PF_STORE = process.env.PRINTFUL_STORE_ID || "14298228";
const OPS_KEY = process.env.OPS_MAINTENANCE_KEY;
if (!PF_TOKEN) { console.error("✗ PRINTFUL_API_TOKEN required"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const cents = (v) => Math.round(Number(v || 0) * 100);
const suggestPrice = (cost) => Math.ceil((Math.ceil(cost / 0.65) + 100) / 100) * 100;

async function pf(path, method = "GET", body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.printful.com/v2${path}`, {
      method,
      headers: { Authorization: `Bearer ${PF_TOKEN}`, "X-PF-Store-Id": PF_STORE, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep(2500 * (attempt + 1)); continue; }
    if (res.status === 204 || res.status === 404 && method === "DELETE") return {};
    const text = await res.text();
    if (!res.ok) throw new Error(`printful ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }
  throw new Error(`printful ${path}: rate-limited`);
}

function loadData() {
  const manifestDoc = JSON.parse(readFileSync("data/product-manifest.json", "utf8"));
  const squareMapDoc = JSON.parse(readFileSync("data/printful-v2-map.json", "utf8")) && JSON.parse(readFileSync("data/square-map.json", "utf8"));
  const pfMapDoc = JSON.parse(readFileSync("data/printful-v2-map.json", "utf8"));
  return { manifestDoc, squareMapDoc, pfMapDoc };
}

function saveData({ manifestDoc, squareMapDoc, pfMapDoc }) {
  writeFileSync("data/product-manifest.json", `${JSON.stringify(manifestDoc, null, 2)}\n`);
  writeFileSync("data/square-map.json", `${JSON.stringify(squareMapDoc, null, 1)}\n`);
  writeFileSync("data/printful-v2-map.json", `${JSON.stringify(pfMapDoc, null, 1)}\n`);
}

async function assertArtReachable(url, { mockupOnly = false } = {}) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Art URL not reachable (${res.status}): ${url} — deploy the art first.`);
  const buf = Buffer.from(await res.arrayBuffer());
  // PNG dimension sniff (IHDR)
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const longest = Math.max(width, height);
    // mockupOnly: printing uses the files already stored on the Printful sync
    // product; this art only renders web mockups, so resolution can't hurt print.
    if (!mockupOnly) {
      if (longest < 1200) throw new Error(`Art is ${width}x${height}px — too small to print (need ≥1800px longest side; hard floor 1200px).`);
      if (longest < 1800) console.warn(`⚠ Art is ${width}x${height}px — below the 1800px guidance; print quality may suffer.`);
    }
    return { width, height };
  }
  return {};
}

async function generateMockups(catalogProductId, variantIds, artUrl, placement, technique = "dtg") {
  try {
    const task = await pf("/mockup-tasks", "POST", {
      format: "jpg",
      products: [{
        source: "catalog",
        catalog_product_id: catalogProductId,
        catalog_variant_ids: variantIds.slice(0, 8),
        placements: [{ placement, technique, layers: [{ type: "file", url: artUrl }] }],
      }],
    });
    const taskIds = (task.data || []).map((t) => t.id).filter(Boolean);
    if (!taskIds.length) return [];
    for (let i = 0; i < 20; i++) {
      await sleep(3000);
      const res = await pf(`/mockup-tasks?id=${taskIds.join(",")}`);
      const all = res.data || [];
      if (all.every((t) => t.status === "completed" || t.status === "failed")) {
        return all.flatMap((t) => (t.catalog_variant_mockups || []).flatMap((m) =>
          (m.mockups || []).map((mm) => ({ variantId: m.catalog_variant_id, url: mm.mockup_url }))
        ));
      }
    }
  } catch (error) {
    console.warn(`⚠ mockup generation failed: ${error.message}`);
  }
  return [];
}

async function createSquareItem({ name, description, variations, imageUrls, dryRun }) {
  if (!OPS_KEY) throw new Error("OPS_MAINTENANCE_KEY required to create the Square item via the production endpoint.");
  const res = await fetch(`${SITE}/api/ops/catalog-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-maintenance-key": OPS_KEY },
    body: JSON.stringify({ name, description, variations, imageUrls, dryRun }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(`Square create failed: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

async function verifyDraftOrder(catalogVariantId, placement, technique, artUrl, position) {
  const draft = await pf("/orders", "POST", {
    recipient: { name: "FACTORY VERIFY DRAFT - DO NOT CONFIRM", address1: "1 Test Street", city: "New York", state_code: "NY", country_code: "US", zip: "10001", email: "info@afterhoursagenda.com" },
    order_items: [{
      source: "catalog", catalog_variant_id: catalogVariantId, quantity: 1,
      placements: [{ placement, technique, layers: [{ type: "file", url: artUrl, ...(position ? { position } : {}) }] }],
    }],
  });
  const id = draft.data?.id;
  if (!id) throw new Error("Draft verification failed: no order id returned");
  await pf(`/orders/${id}`, "DELETE");
  return id;
}

async function computeCost(catalogVariantId, placements) {
  const priceData = (await pf(`/catalog-variants/${catalogVariantId}/prices`)).data;
  const techKey = (t) => ({ sticker: "digital", knitting: "knitwear", "phone-case": "uv" }[t] ?? t);
  const primary = placements[0];
  const technique = priceData.variant.techniques.find((x) => x.technique_key === techKey(primary.technique));
  if (!technique) return null;
  let total = cents(technique.discounted_price || technique.price);
  for (const pl of placements.slice(1)) {
    const extra = priceData.product.placements.find((x) => x.id === pl.placement && (!x.technique_key || x.technique_key === techKey(pl.technique)));
    total += cents(extra?.discounted_price || extra?.price);
  }
  return total > 0 ? total : null;
}

async function main() {
  const resurrectSlug = opt("resurrect");
  const data = loadData();
  const { manifestDoc, squareMapDoc, pfMapDoc } = data;
  const products = manifestDoc.products;

  let plan;
  if (resurrectSlug) {
    // ── Resurrection: rebuild the Square side of an existing Printful-configured product ──
    const product = products.find((p) => p.slug === resurrectSlug);
    if (!product) throw new Error(`No manifest product: ${resurrectSlug}`);
    const priceCents = Number(opt("price"));
    if (!(priceCents > 0)) throw new Error("--price <cents> required for resurrection");

    // Pull sync product for positions + catalog variant ids
    let offset = 0, page, syncVariants = [];
    do {
      page = await pf(`/sync-products?limit=100&offset=${offset}`);
      const hit = (page.data || []).find((p) => p.name === product.title);
      if (hit) {
        syncVariants = (await pf(`/sync-products/${hit.id}/sync-variants`)).data || [];
        break;
      }
      offset += 100;
    } while ((page.data || []).length === 100);
    if (!syncVariants.length) throw new Error(`No Printful sync product named "${product.title}"`);

    const artUrl = opt("art") || `${SITE}/printful-assets/${product.title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}.png`;
    // The living sync product carries the original print files, so orders go
    // out sync-fulfilled; this art is only for web mockups.
    await assertArtReachable(artUrl, { mockupOnly: true });

    const bySize = new Map();
    for (const sv of syncVariants) {
      const size = (sv.name.split("/").pop() || "OS").trim().toUpperCase();
      bySize.set(size, sv);
    }
    plan = {
      kind: "resurrect", product, priceCents, artUrl,
      variants: product.variants.map((v) => {
        const sv = bySize.get(String(v.size).toUpperCase());
        if (!sv) throw new Error(`No sync variant for size ${v.size}`);
        const placements = (sv.placements || []).filter((pl) => pl.placement && pl.technique).map((pl) => ({
          placement: pl.placement, technique: pl.technique,
          fileUrl: artUrl,
          position: pl.layers?.[0]?.position,
        }));
        return { manifestVariant: v, catalogVariantId: sv.catalog_variant_id, syncVariantId: sv.id, placements };
      }),
    };
  } else {
    // ── New product from spec ──
    const specPath = opt("spec");
    if (!specPath) throw new Error("--spec <file> or --resurrect <slug> required");
    const spec = JSON.parse(readFileSync(specPath, "utf8"));
    await assertArtReachable(spec.artUrl);

    const productData = (await pf(`/catalog-products/${spec.garmentCatalogProductId}`)).data;
    const catalogVariants = (await pf(`/catalog-products/${spec.garmentCatalogProductId}/catalog-variants`)).data || [];
    const wantColors = spec.colors?.map((c) => c.toLowerCase());
    const wantSizes = spec.sizes?.map((s) => String(s).toUpperCase());
    const chosen = catalogVariants.filter((v) =>
      (!wantColors || wantColors.includes(String(v.color).toLowerCase())) &&
      (!wantSizes || wantSizes.includes(String(v.size).toUpperCase()))
    );
    if (!chosen.length) throw new Error("No catalog variants match the requested colors/sizes");

    // ── Blank intelligence: derive technique/placement/options from the blank
    //    itself so ANY product type (dtg, embroidery, sublimation, cut-sew,
    //    stickers, uv) works from the same simple spec. ──
    const blankTechniques = (productData.techniques || []).map((t) => t.key);
    const defaultTechnique = (productData.techniques || []).find((t) => t.is_default)?.key || blankTechniques[0] || "dtg";
    const technique = spec.technique || defaultTechnique;
    if (blankTechniques.length && !blankTechniques.includes(technique)) {
      throw new Error(`Technique ${technique} not offered for ${productData.name}. Offered: ${blankTechniques.join(", ")}`);
    }
    const offered = productData.placements || [];
    const placement = spec.placement
      || offered.find((pl) => (pl.technique ?? technique) === technique && /^(front|default)/.test(pl.placement))?.placement
      || offered[0]?.placement
      || "front";
    const validPlacement = offered.some((pl) => pl.placement === placement);
    if (!validPlacement) throw new Error(`Placement ${placement} not offered for ${productData.name}. Offered: ${offered.map((pl) => pl.placement).join(", ")}`);

    // Required product options (e.g. cut-sew stitch_color) are auto-filled with
    // the spec's value or a sensible default, and recorded for every order.
    let productOptions = spec.productOptions || null;
    if (!productOptions) {
      const optionDefs = (productData.product_options || []).filter((o) => o.required || o.name === "stitch_color");
      if (optionDefs.some((o) => o.name === "stitch_color") || technique === "cut-sew") {
        productOptions = [{ name: "stitch_color", value: spec.stitchColor || "black" }];
      }
    }
    // Layer options (e.g. 3d_puff on embroidered hats) pass straight through.
    const layerOptions = spec.layerOptions || null;

    if (spec.story && String(spec.story).trim().length < 40) {
      throw new Error("spec.story is too short — write the real story of the design (2+ sentences).");
    }

    plan = {
      kind: "new", spec,
      garmentName: productData.name,
      artUrl: spec.artUrl,
      productOptions,
      variants: chosen.map((v) => ({
        catalogVariantId: v.id, color: v.color, size: String(v.size).toUpperCase(),
        placements: [{
          placement, technique, fileUrl: spec.artUrl,
          ...(spec.position ? { position: spec.position } : {}),
          ...(layerOptions ? { layerOptions } : {}),
        }],
      })),
    };
  }

  // ── Costs + pricing ──
  const costCache = new Map();
  for (const v of plan.variants) {
    const key = v.catalogVariantId;
    if (!costCache.has(key)) costCache.set(key, await computeCost(key, v.placements));
    v.cost = costCache.get(key);
    if (!v.cost) throw new Error(`No cost for catalog variant ${key}`);
    await sleep(150);
  }
  const maxCost = Math.max(...plan.variants.map((v) => v.cost));
  const floor = suggestPrice(maxCost);
  const priceCents = plan.kind === "resurrect"
    ? plan.priceCents
    : (plan.spec.retailPrice && plan.spec.retailPrice !== "auto" ? plan.spec.retailPrice : floor);
  // Optional per-size prices: --price-map '{"3″×3″":600,"15″×3.75″":1100}'
  const priceMap = opt("price-map") ? JSON.parse(opt("price-map")) : {};
  const priceFor = (v) => priceMap[String(v.manifestVariant?.size ?? v.size)] ?? priceCents;
  for (const v of plan.variants) {
    const p = priceFor(v);
    const vFloor = Math.ceil(v.cost / 0.65);
    if (p < vFloor) throw new Error(`Price ${p} for ${v.manifestVariant?.size ?? v.size} is below its 35% floor ${vFloor} (cost ${v.cost}).`);
  }

  const title = plan.kind === "resurrect" ? plan.product.title : plan.spec.name;
  const slug = plan.kind === "resurrect" ? plan.product.slug : slugify(plan.spec.name);
  console.log(`\n${LIVE ? "LIVE" : "DRY RUN"} — ${title} (${slug})`);
  console.log(`  variants: ${plan.variants.length} | max cost: $${(maxCost / 100).toFixed(2)} | price: $${(priceCents / 100).toFixed(2)} (floor $${(floor / 100).toFixed(2)})`);
  for (const v of plan.variants.slice(0, 4)) console.log(`  - cat ${v.catalogVariantId} ${v.manifestVariant?.size ?? v.size ?? ""} ${v.color || ""} cost $${(v.cost / 100).toFixed(2)} price $${(priceFor(v) / 100).toFixed(2)} placements=${v.placements.map((p) => p.placement).join("+")}`);

  if (!LIVE) { console.log("\nDry run complete. Re-run with --live to create."); return; }

  // ── Mockups (Printful CDN URLs, publicly fetchable for Square upload) ──
  let mockups = [];
  if (plan.kind === "new") {
    mockups = await generateMockups(plan.spec.garmentCatalogProductId, plan.variants.map((v) => v.catalogVariantId), plan.artUrl, plan.variants[0].placements[0].placement, plan.variants[0].placements[0].technique);
    console.log(`  mockups generated: ${mockups.length}`);
  }
  const imageUrls = mockups.slice(0, 4).map((m) => m.url);
  if (!imageUrls.length) imageUrls.push(plan.artUrl);

  // ── Square item ──
  const sizes = plan.kind === "resurrect"
    ? plan.variants.map((v) => ({ name: String(v.manifestVariant.size), priceCents: priceFor(v), sku: v.manifestVariant.sku }))
    : plan.variants.map((v) => ({ name: v.color && plan.variants.some((x) => x.color !== v.color) ? `${v.color} / ${v.size}` : v.size, priceCents: priceFor(v), sku: `${slug}-${v.catalogVariantId}` }));
  const story = plan.kind === "new" ? plan.spec.story : plan.product?.fullDescription;
  const description = story || `${title} by After Hours Agenda. Printed to order.`;
  const square = await createSquareItem({
    name: title,
    description,
    descriptionHtml: story ? `<p>${story}</p><p>Printed to order in 2–5 business days. Free shipping.</p>` : undefined,
    categoryName: plan.kind === "new" ? (plan.spec.categoryName || plan.spec.productType || "tee") : plan.product?.productType,
    variations: sizes, imageUrls,
  });
  console.log(`  square item: ${square.itemId} (${Object.keys(square.variationIds).length} variations)`);
  if (square.imageErrors?.length) console.warn("  ⚠ image issues:", square.imageErrors);

  // ── Data files ──
  const now = new Date().toISOString();
  if (plan.kind === "resurrect") {
    const product = plan.product;
    product.retailPrice = Math.min(...plan.variants.map(priceFor));
    for (const v of plan.variants) {
      const mv = v.manifestVariant;
      mv.retailPrice = priceFor(v);
      mv.status = "active";
      const sqVarId = square.variationIds[String(mv.size)] || square.variationIds[Object.keys(square.variationIds).find((k) => k.toUpperCase().includes(String(mv.size).toUpperCase())) ?? ""];
      if (!sqVarId) throw new Error(`No Square variation id for size ${mv.size}`);
      squareMapDoc.map[mv.ahaVariantId] = { squareCatalogObjectId: square.itemId, squareVariationId: sqVarId, squareLocationId: "FGKRPYEXNV482" };
      pfMapDoc.map[mv.ahaVariantId] = {
        printfulCatalogVariantId: v.catalogVariantId,
        ...(v.syncVariantId ? { printfulSyncVariantId: v.syncVariantId } : {}),
        printfulStoreId: Number(PF_STORE),
        printfulPlacements: v.placements,
        printfulRegionAvailability: ["north_america"],
        printfulSizeGuideReference: product.sizeGuideId,
        costEstimate: v.cost, costCurrency: "USD", costVerifiedAt: now,
      };
    }
    if (product.variants.every((v) => v.status === "active")) product.status = "active";
  } else {
    const spec = plan.spec;
    const variants = plan.variants.map((v, i) => {
      const optionKey = slugify(v.color ? `${v.color}-${v.size}` : v.size) || String(i);
      const vid = `${slug}-${optionKey}-${v.catalogVariantId}`;
      // exact variation-name match (mirrors how the Square variations were named)
      const expectedName = v.color && plan.variants.some((x) => x.color !== v.color) ? `${v.color} / ${v.size}` : v.size;
      const squareVariationId = square.variationIds[expectedName]
        ?? square.variationIds[Object.keys(square.variationIds).find((k) => k.toUpperCase() === expectedName.toUpperCase()) ?? ""];
      if (!squareVariationId) throw new Error(`No Square variation named "${expectedName}"`);
      squareMapDoc.map[vid] = { squareCatalogObjectId: square.itemId, squareVariationId, squareLocationId: "FGKRPYEXNV482" };
      pfMapDoc.map[vid] = {
        printfulCatalogVariantId: v.catalogVariantId, printfulStoreId: Number(PF_STORE),
        printfulPlacements: v.placements.map(({ layerOptions, ...pl }) => pl),
        ...(plan.productOptions ? { printfulProductOptions: plan.productOptions } : {}),
        printfulRegionAvailability: ["north_america"],
        printfulSizeGuideReference: `sg-${spec.productType || "tee"}`,
        costEstimate: v.cost, costCurrency: "USD", costVerifiedAt: now,
      };
      return {
        ahaVariantId: vid, ahaProductId: slug, sku: `${slug}-${v.catalogVariantId}`, size: v.size,
        color: v.color || undefined, retailPrice: priceCents, currency: "USD", status: "active",
        printfulSource: "catalog", sortOrder: i,
      };
    });
    const technique = plan.variants[0]?.placements[0]?.technique || "dtg";
    const PRINT_METHOD = {
      dtg: "DTG/DTF", embroidery: "Embroidery (auto-digitized)", "cut-sew": "All-over cut & sew",
      sublimation: "Sublimation", uv: "UV print", digital: "Digital print", knitwear: "Knitted",
    };
    products.push({
      ahaProductId: slug, slug, title, shortDescription: spec.shortDescription || title,
      fullDescription: spec.story || `${title} by After Hours Agenda. Printed to order.`,
      ...(spec.story ? { storySource: "authored" } : {}),
      productType: spec.productType || "tee", collectionIds: spec.collectionIds || ["tees"],
      status: "active", retailPrice: priceCents, currency: "USD",
      fitDescription: spec.fitDescription || "Standard unisex fit — true to size.",
      fabricDescription: spec.fabricDescription || "See size guide for materials.",
      ogImage: "/brand/og-image.png",
      printMethod: PRINT_METHOD[technique] || technique,
      careInstructions: "Machine wash cold, inside out. Tumble dry low. Do not iron the print. Do not dry clean.",
      productionNote: "Made to order and printed just for you. Production takes 2–5 business days before shipping.",
      shippingNote: "Free shipping on every order. Delivery includes production time plus carrier transit.",
      returnsNote: "Exchanges and returns on unworn items within 30 days. Misprints and defects are always on us.",
      sizeGuideId: `sg-${spec.productType || "tee"}`,
      featuredImage: `/products/${slug}.webp`, galleryImages: [],
      seoTitle: `${title} — After Hours Agenda`, seoDescription: `${title}. NYC streetwear, printed to order. Free shipping.`,
      variants,
    });
  }
  saveData(data);
  console.log("  data files written");

  // ── Draft-order fulfillment verification (free, deleted immediately) ──
  if (VERIFY_DRAFT) {
    const v = plan.variants[0];
    const pl = v.placements[0];
    const draftId = await verifyDraftOrder(v.catalogVariantId, pl.placement, pl.technique, pl.fileUrl, pl.position);
    console.log(`  ✓ fulfillment verified via draft order ${draftId} (deleted)`);
  }

  // ── Gates ──
  execSync("npm run validate:all", { stdio: "inherit" });

  if (PUSH) {
    execSync(`git add data/ public/ lib/square/catalog.ts && git commit -m "product-factory: ${title}" && git push origin main`, { stdio: "inherit" });
    console.log("  pushed — live after the Netlify build.");
  } else {
    console.log("\nNext: convert mockups if needed, then commit data/ and deploy.");
  }
}

main().catch((error) => { console.error(`✗ ${error.message}`); process.exit(1); });
