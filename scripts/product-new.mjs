// product:new — drop a design in, get a live product out. One command.
//
// This is the hands-off wrapper around scripts/product-factory.mjs. It hosts the
// art (public repo → instant raw URL), writes the spec from a garment preset, runs
// the factory live, pushes, and verifies the product is live in the storefront.
//
//   npm run product:new -- --art <file.png> --preset women-tee --name "Black Sheep Baby Doll" \
//     --story "Two sentences of real story." [--colors Black,Bone] [--sizes S,M,L,XL,2XL] \
//     [--price 3000] [--live]
//
// Without --live it prints a local preview (preset resolution + art check), touches
// nothing, and pushes nothing. With --live it hosts + creates + pushes + verifies.
//
// Presets: see data/garment-presets.json (women-tee, unisex-tee, hoodie, crewneck + aliases).
// Env (source .env.local first): PRINTFUL_API_TOKEN, OPS_MAINTENANCE_KEY, SITE_URL.
import { readFileSync, copyFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { basename } from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const list = (n) => { const v = opt(n); return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined; };

const LIVE = flag("live");
const SITE = (process.env.SITE_URL || "https://afterhoursagenda.com").replace(/\/$/, "");
const REPO_RAW = "https://raw.githubusercontent.com/omgitsthedm/aha-website/main";
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

// Read PNG dimensions from a local file (IHDR) to enforce the print-resolution floor.
function pngDims(path) {
  const buf = readFileSync(path);
  if (!(buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG")) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function urlOk(url) {
  try { const r = await fetch(url, { method: "GET" }); return r.ok; } catch { return false; }
}

async function pollOk(url, { tries = 40, gapMs = 6000, label = "url" } = {}) {
  for (let i = 0; i < tries; i++) {
    if (await urlOk(url)) return true;
    process.stdout.write(`  …waiting on ${label} (${i + 1}/${tries})\r`);
    await sleep(gapMs);
  }
  return false;
}

async function main() {
  const name = opt("name");
  const preset = opt("preset");
  const artPath = opt("art");
  const artUrlIn = opt("art-url"); // already-hosted URL (skips hosting)
  const story = opt("story");
  if (!name) die("--name required");
  if (!preset) die("--preset required (women-tee | unisex-tee | hoodie | crewneck | …)");
  if (!artPath && !artUrlIn) die("--art <file> (or --art-url <url>) required");

  // Validate the preset exists up front (clear error before any work).
  const presetDoc = JSON.parse(readFileSync("data/garment-presets.json", "utf8"));
  const canon = presetDoc.aliases?.[preset] || preset;
  const presetDef = presetDoc.presets?.[canon];
  if (!presetDef) die(`unknown preset "${preset}". Known: ${Object.keys(presetDoc.presets).join(", ")} | aliases: ${Object.keys(presetDoc.aliases).join(", ")}`);

  const slug = slugify(name);
  const colors = list("colors") || presetDef.defaultColors;
  const sizes = list("sizes") || presetDef.defaultSizes;

  // Resolve art hosting.
  let artUrl = artUrlIn;
  let mockupArtUrl = artUrlIn;
  let hostFile = null;
  if (artPath) {
    if (!existsSync(artPath)) die(`art file not found: ${artPath}`);
    const dims = pngDims(artPath);
    if (!dims) die("art must be a PNG");
    const longest = Math.max(dims.width, dims.height);
    if (longest < 1200) die(`art is ${dims.width}×${dims.height}px — hard floor is 1200px longest side (want ≥1800px).`);
    if (longest < 1800) console.warn(`⚠ art is ${dims.width}×${dims.height}px — below the 1800px print guidance.`);
    const hostName = `${slug}.png`;
    hostFile = `public/printful-assets/${hostName}`;
    artUrl = `${SITE}/printful-assets/${hostName}`;               // durable, canonical → fulfillment
    mockupArtUrl = `${REPO_RAW}/public/printful-assets/${hostName}`; // instant after push → mockups
  }

  console.log(`\n▶ product:new — "${name}" (${slug})`);
  console.log(`  preset: ${preset}${canon !== preset ? ` → ${canon}` : ""} | blank: ${presetDef.blank}`);
  console.log(`  type: ${presetDef.productType} | category: ${presetDef.category} | gender: ${presetDef.gender.join("/")} | collections: ${presetDef.collectionIds.join(",")}`);
  console.log(`  colors: ${colors.join(", ")} | sizes: ${sizes.join(", ")}`);
  console.log(`  art → ${artUrl}${mockupArtUrl !== artUrl ? `\n  mockups ← ${mockupArtUrl}` : ""}`);
  if (story) console.log(`  story: ${story.slice(0, 80)}${story.length > 80 ? "…" : ""}`);

  if (!LIVE) {
    console.log(`\n(dry preview — nothing hosted, nothing created). Add --live to create + publish.`);
    if (artPath && !story) console.log(`Tip: add --story "…2+ sentences…" so the PDP ships with real copy.`);
    return;
  }

  if (story && story.trim().length < 40) die("--story is too short — write the real story (2+ sentences).");

  // ── 1. Host the art (public repo → raw URL live within seconds) ──
  if (artPath) {
    mkdirSync("public/printful-assets", { recursive: true });
    copyFileSync(artPath, hostFile);
    console.log(`\n① hosting art → ${hostFile}`);
    sh(`git add ${hostFile}`);
    // Only commit if the asset is new/changed (copyFile of an identical file is a no-op to git).
    try { sh(`git commit -m "assets: art for ${name}"`); sh(`git push origin main`); }
    catch { console.log("  (art already committed — continuing)"); }
    console.log(`② confirming art is fetchable by Printful…`);
    const ok = await pollOk(mockupArtUrl, { label: "raw art URL" });
    if (!ok) die(`art URL never became reachable: ${mockupArtUrl}`);
    console.log(`\n  ✓ art live`);
  }

  // ── 2. Write the spec + run the factory (create Square item, mockups, data maps, validate, push) ──
  const spec = {
    name, preset, story,
    ...(colors ? { colors } : {}),
    ...(sizes ? { sizes } : {}),
    ...(opt("price") ? { retailPrice: Number(opt("price")) } : {}),
    artUrl,
    ...(mockupArtUrl !== artUrl ? { mockupArtUrl } : {}),
  };
  mkdirSync(".tmp", { recursive: true });
  const specPath = `.tmp/spec-${slug}.json`;
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  console.log(`\n③ running product factory (live)…\n`);
  sh(`node scripts/product-factory.mjs --spec ${specPath} --live --push`);

  // ── 3. Verify it is live in the storefront ──
  console.log(`\n④ verifying live storefront…`);
  const pdp = `${SITE}/product/${slug}`;
  const pdpOk = await pollOk(pdp, { label: "PDP deploy" });
  if (!pdpOk) die(`PDP not live yet: ${pdp} (Netlify build may still be running — re-check shortly).`);
  const genders = presetDef.gender;
  const grids = ["shop", ...genders.filter((g) => g !== "unisex")];
  const results = [];
  for (const g of grids) {
    try { const html = await (await fetch(`${SITE}/${g}`)).text(); results.push(`/${g}:${html.includes(slug) ? "✓" : "✗"}`); }
    catch { results.push(`/${g}:err`); }
  }
  console.log(`\n✅ LIVE — ${pdp}`);
  console.log(`   grids → ${results.join("  ")}`);
}

main().catch((e) => die(e.message));
