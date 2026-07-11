// Create a product from the command line → live in the store.
// Pipeline: Printful sync product (with art) → Square catalog item (price + sizes) → remap manifest.
// The storefront picks up the new Square item live (ISR); commit+push the manifest to enable fulfillment.
//
//   node scripts/create-product.mjs --spec product.json            # dry run (prints the plan)
//   node scripts/create-product.mjs --spec product.json --live     # actually creates it
//
// Spec (product.json):
// {
//   "name": "Midnight Runners Tee",
//   "retailPrice": 3800,                 // cents
//   "currency": "USD",
//   "placements": [ { "placement": "front", "technique": "dtg", "fileUrl": "https://.../art.png" } ],
//   "variants": [ { "size": "S", "catalogVariantId": 4012 }, { "size": "M", "catalogVariantId": 4013 } ]
// }
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const PREFLIGHT = args.includes("--preflight") || LIVE;
const specPath = args[args.indexOf("--spec") + 1];
if (!specPath || args.indexOf("--spec") === -1) {
  console.error("Usage: node scripts/create-product.mjs --spec product.json [--live]");
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const providerRegistry = JSON.parse(readFileSync(new URL("../data/provider-registry.json", import.meta.url), "utf8"));

const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
// Product creation must target the NATIVE (Manual/API) store — the Square-integrated store blocks it.
const verifiedRegistryStore = providerRegistry.printful.nativeApiStoreStatus === "verified"
  ? providerRegistry.printful.nativeApiStoreId
  : null;
const PF_STORE = process.env.PRINTFUL_NATIVE_STORE_ID || verifiedRegistryStore;
const SQ_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQ_VER = process.env.SQUARE_API_VERSION || "2024-01-18";
const SQ_LOC = process.env.SQUARE_LOCATION_ID || providerRegistry.square.locationId;

function assert(cond, msg) { if (!cond) { console.error("✗", msg); process.exit(1); } }
assert(spec.name && spec.retailPrice > 0, "spec needs name + retailPrice (cents)");
assert(Array.isArray(spec.variants) && spec.variants.length, "spec needs variants[] (size + catalogVariantId)");
assert(Array.isArray(spec.placements) && spec.placements.some((p) => p.fileUrl), "spec needs placements[] with a fileUrl");
const currency = spec.currency || "USD";

async function api(url, opts, label) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function preflight() {
  assert(PF_TOKEN && SQ_TOKEN, "PRINTFUL_API_TOKEN + SQUARE_ACCESS_TOKEN required for preflight/live mode");
  assert(PF_STORE, "PRINTFUL_NATIVE_STORE_ID is required and must identify a verified Manual/API store; the current provider registry has none");

  const art = await fetch(spec.placements[0].fileUrl, { method: "HEAD" });
  assert(art.ok, `art URL is not reachable (${art.status})`);
  const contentType = art.headers.get("content-type") || "";
  assert(contentType.startsWith("image/"), `art URL must return an image content type, got ${contentType || "none"}`);

  for (const variant of spec.variants) {
    const result = await api(`https://api.printful.com/v2/catalog-variants/${variant.catalogVariantId}`, {
      headers: { Authorization: `Bearer ${PF_TOKEN}`, "X-PF-Store-Id": PF_STORE },
    }, `Printful catalog variant ${variant.catalogVariantId}`);
    const remoteSize = String(result?.data?.size || "").toUpperCase();
    assert(remoteSize === String(variant.size).toUpperCase(),
      `size mismatch for ${variant.catalogVariantId}: spec=${variant.size}, Printful=${remoteSize || "unknown"}`);
  }

  const squareSearch = await api("https://connect.squareup.com/v2/catalog/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${SQ_TOKEN}`, "Square-Version": SQ_VER, "Content-Type": "application/json" },
    body: JSON.stringify({ object_types: ["ITEM"], query: { prefix_query: { attribute_name: "name", attribute_prefix: spec.name } }, limit: 100 }),
  }, "Square duplicate search");
  const squareDuplicate = (squareSearch.objects || []).find((item) => normalize(item.item_data?.name) === normalize(spec.name));

  const printfulProducts = await api("https://api.printful.com/store/products?limit=100", {
    headers: { Authorization: `Bearer ${PF_TOKEN}`, "X-PF-Store-Id": PF_STORE },
  }, "Printful duplicate search");
  const printfulDuplicate = (printfulProducts.result || []).find((item) => normalize(item.name) === normalize(spec.name));

  if (squareDuplicate || printfulDuplicate) {
    console.error("✗ duplicate/partial product state found; no remote writes performed");
    if (squareDuplicate) console.error(`  Square item already exists: ${squareDuplicate.id}`);
    if (printfulDuplicate) console.error(`  Printful product already exists on store ${PF_STORE}: ${printfulDuplicate.id}`);
    console.error("  Reconcile the existing records and rerun map population instead of creating duplicates.");
    process.exit(1);
  }
  console.log("  ✓ preflight: art, variants, provider access, and duplicate checks passed");
}

async function createPrintful() {
  // Printful v1 create sync product on the NATIVE store (art attached via the file url).
  const body = {
    sync_product: { name: spec.name },
    sync_variants: spec.variants.map((v) => ({
      variant_id: v.catalogVariantId,
      retail_price: (spec.retailPrice / 100).toFixed(2),
      files: spec.placements.map((p) => ({ type: p.placement === "front" ? "default" : p.placement, url: p.fileUrl })),
    })),
  };
  const out = await api("https://api.printful.com/store/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${PF_TOKEN}`, "X-PF-Store-Id": PF_STORE, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, "Printful create");
  return out?.result?.id;
}

async function attachSquareImage(itemId, imageUrl) {
  // Upload the art as the Square catalog image so it shows on the storefront.
  const bytes = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
  const form = new FormData();
  form.append("request", JSON.stringify({
    idempotency_key: randomUUID(),
    object_id: itemId,
    image: { type: "IMAGE", id: "#img", image_data: { name: `${spec.name} art`, caption: spec.name } },
  }));
  form.append("file", new Blob([bytes], { type: "image/png" }), "art.png");
  const res = await fetch("https://connect.squareup.com/v2/catalog/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${SQ_TOKEN}`, "Square-Version": SQ_VER },
    body: form,
  });
  if (!res.ok) { console.warn(`  ⚠ Square image attach failed (${res.status}) — product still created.`); return; }
  console.log("  ✓ Square product image attached");
}

async function createSquare() {
  // Square catalog item + one variation per size. Provider IDs must be written directly into the
  // internal registry after creation; name/size matching is never a fulfillment join.
  const object = {
    type: "ITEM",
    id: "#item",
    item_data: {
      name: spec.name,
      variations: spec.variants.map((v, i) => ({
        type: "ITEM_VARIATION",
        id: `#v${i}`,
        item_variation_data: {
          item_id: "#item", name: v.size, pricing_type: "FIXED_PRICING",
          price_money: { amount: spec.retailPrice, currency },
          sku: `${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${v.catalogVariantId}`,
        },
      })),
    },
  };
  const out = await api("https://connect.squareup.com/v2/catalog/object", {
    method: "POST",
    headers: { Authorization: `Bearer ${SQ_TOKEN}`, "Square-Version": SQ_VER, "Content-Type": "application/json" },
    body: JSON.stringify({ idempotency_key: randomUUID(), object }),
  }, "Square upsert");
  return out?.catalog_object?.id;
}

async function main() {
  console.log(`→ ${LIVE ? "CREATING" : "DRY RUN for"} "${spec.name}" — ${spec.variants.length} size(s) @ $${(spec.retailPrice / 100).toFixed(2)}`);
  console.log(`  placements: ${spec.placements.map((p) => `${p.placement}/${p.technique}`).join(", ")}`);
  if (!LIVE) {
    if (PREFLIGHT) await preflight();
    console.log("  (dry run) — would create Printful sync product + Square item, then remap the manifest.");
    console.log("  Run with --preflight for remote read-only validation; --live requires scoped approval.");
    return;
  }
  await preflight();
  let pfId;
  let sqId;
  pfId = await createPrintful();
  console.log(`  ✓ Printful sync product created on native store (id ${pfId}) — art attached`);
  try {
    sqId = await createSquare();
  } catch (error) {
    console.error(`✗ Square creation failed after Printful product ${pfId} was created.`);
    console.error(`  Recovery: inspect Printful store ${PF_STORE}, product ${pfId}; do not rerun until reconciled.`);
    throw error;
  }
  console.log(`  ✓ Square item created (id ${sqId})`);
  if (sqId && spec.placements[0]?.fileUrl) await attachSquareImage(sqId, spec.placements[0].fileUrl);
  console.log("→ remapping manifest…");
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("./populate-maps.mjs", import.meta.url))], { stdio: "inherit", env: process.env });
  if (r.status !== 0) { console.error("✗ populate-maps failed — run it manually"); process.exit(1); }
  console.log("\n✓ Live in Square now (storefront picks it up via ISR within ~5 min).");
  console.log("  Commit the updated data/ and push to enable mapping/validation:");
  console.log("    git add data/ && git commit -m 'Add product: " + spec.name + "' && git push");
}

main().catch((e) => { console.error("✗ create-product failed:", e.message); process.exit(1); });
