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
const specPath = args[args.indexOf("--spec") + 1];
if (!specPath || args.indexOf("--spec") === -1) {
  console.error("Usage: node scripts/create-product.mjs --spec product.json [--live]");
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const PF_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PF_STORE = process.env.PRINTFUL_STORE_ID;
const SQ_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQ_VER = process.env.SQUARE_API_VERSION || "2024-01-18";
const SQ_LOC = process.env.SQUARE_LOCATION_ID || "FGKRPYEXNV482";

function assert(cond, msg) { if (!cond) { console.error("✗", msg); process.exit(1); } }
assert(spec.name && spec.retailPrice > 0, "spec needs name + retailPrice (cents)");
assert(Array.isArray(spec.variants) && spec.variants.length, "spec needs variants[] (size + catalogVariantId)");
assert(Array.isArray(spec.placements) && spec.placements.some((p) => p.fileUrl), "spec needs placements[] with a fileUrl");
const currency = spec.currency || "USD";

async function api(url, opts, label, { fatal = true } = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    if (!fatal) return { _error: true, status: res.status, body: text };
    console.error(`✗ ${label} ${res.status}: ${text.slice(0, 300)}`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : {};
}

async function createPrintful() {
  // Printful v1 create sync product. NOTE: only works for Manual Order / API stores. Square-integrated
  // Printful stores block this — products are created via the Printful dashboard / Square sync instead.
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
  }, "Printful create", { fatal: false });
  if (out?._error) {
    console.warn(`  ⚠ Printful create unavailable via API for this store (status ${out.status}).`);
    console.warn("    Square-integrated store: attach the art to this product in the Printful dashboard to enable fulfillment.");
    return null;
  }
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
  // Square catalog item + one variation per size (name = size; the join is by name+size).
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
    console.log("  (dry run) — would create Printful sync product + Square item, then remap the manifest.");
    console.log("  Re-run with --live to create it for real.");
    return;
  }
  assert(PF_TOKEN && SQ_TOKEN, "PRINTFUL_API_TOKEN + SQUARE_ACCESS_TOKEN required in env");
  const pfId = await createPrintful();
  if (pfId) console.log(`  ✓ Printful sync product created (id ${pfId})`);
  const sqId = await createSquare();
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
  if (!pfId) {
    console.log("\n  ⚠ Fulfillment: this Square-integrated Printful store can't accept API product creation.");
    console.log("    Open Printful → your store → this product → attach the art (front) so orders fulfill automatically.");
  }
}

main().catch((e) => { console.error("✗ create-product failed:", e.message); process.exit(1); });
