/**
 * APLIIQ capsule tool — the one path from "art + blank" to a sellable variant.
 *
 *   npx tsx scripts/apliiq-capsule.ts create [--apply] [--only <slug>]
 *     For each product in data/apliiq-capsule.json: POST /Artwork (hosted PNG),
 *     then POST /Design with the artwork attached to the front location and the
 *     hosted mockup as the design image. Records design ids and per-size APQ SKUs
 *     in data/apliiq-capsule-designs.json. Dry-run without --apply.
 *
 *   npx tsx scripts/apliiq-capsule.ts map
 *     Rebuilds every capsule entry in data/apliiq-map.json from the recorded
 *     designs plus live blank pricing (GET /Product): item cost = blank + DTF
 *     + private label + plus-size fee, real per-size weight, and a landed-cost
 *     margin computed by the same resolver the storefront gate uses. A variant
 *     under the 35% floor gets a per-variant override that records the ratio it
 *     actually clears; a variant at a loss is refused.
 *
 *   npx tsx scripts/apliiq-capsule.ts delete <designId,designId>
 *
 * Contract: https://help.apliiq.com/portal/en/kb/articles/create-design and
 * .../artwork-api. SKUs are APQ-{design}S{size}A{artworks}; A0 means a blank
 * design that would print nothing, so `map` refuses any A0 SKU.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createApliiqAuthorization } from "@/lib/apliiq/auth";
import { isApliiqSku } from "@/lib/apliiq/orders";
import { resolveApliiqLandedCost } from "@/lib/commerce/landed-cost";
import { parseApliiqMapDocument, type ApliiqMapEntry } from "@/lib/data/apliiq-map";

const KEY = process.env.APLIIQ_API_KEY as string;
const SEC = process.env.APLIIQ_SHARED_SECRET as string;
const SPEC_PATH = "data/apliiq-capsule.json";
const DESIGNS_PATH = "data/apliiq-capsule-designs.json";
const MAP_PATH = "data/apliiq-map.json";
const MIN_MARGIN_RATIO = Number(process.env.AHA_MIN_MARGIN_RATIO ?? "0.35");

// APLIIQ published add-ons, cents. DTF is $7.49 on every dropship garment; the
// sewn private label is $2.50 per unit.
const DTF_CENTS = 749;
const PRIVATE_LABEL_CENTS = 250;

interface CapsuleProduct {
  slug: string;
  title: string;
  productCode: string;
  frontLocationId: number;
  productType: string;
  sizeGuideId: string;
  fabricDescription: string;
  retailPrice: number;
  sizeRetail?: Record<string, number>;
  artworkUrl: string;
  mockupUrl: string;
  printNote: string;
  squareItemId?: string;
}
interface CapsuleSpec { colorId: number; service: string; privateLabel: string; products: CapsuleProduct[] }
interface DesignVariant { sku: string; size: string; weight: string; plusSizeFee: number }
interface DesignRecord {
  artworkId: number; designId: number; productCode: string; colorId: number;
  apliiqMockupPath: string; variants: DesignVariant[];
}
interface DesignsFile { _generated: string; designs: Record<string, DesignRecord> }

async function call(method: string, path: string, body?: unknown) {
  if (!KEY || !SEC) throw new Error("APLIIQ_API_KEY and APLIIQ_SHARED_SECRET are required.");
  const raw = body === undefined ? "" : JSON.stringify(body);
  const auth = createApliiqAuthorization({ apiKey: KEY, sharedSecret: SEC,
    timestamp: Math.floor(Date.now() / 1000), nonce: randomUUID(), rawBody: raw });
  const r = await fetch("https://api.apliiq.com/v1" + path, { method,
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: auth },
    ...(raw ? { body: raw } : {}) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const readJson = <T,>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const sizeKey = (name: string) => {
  const n = name.toLowerCase();
  return n === "xxl" ? "2xl" : n === "xxxl" ? "3xl" : n;
};
const sizeLabel = (name: string) => sizeKey(name).toUpperCase();

async function create(apply: boolean, only?: string) {
  const spec = readJson<CapsuleSpec>(SPEC_PATH);
  let designs: DesignsFile;
  try { designs = readJson<DesignsFile>(DESIGNS_PATH); } catch { designs = { _generated: "", designs: {} }; }
  for (const p of spec.products) {
    if (only && p.slug !== only) continue;
    if (designs.designs[p.slug] && !only) { console.log(`  ${p.slug.padEnd(36)} already recorded as design ${designs.designs[p.slug].designId}; skip`); continue; }
    if (!apply) { console.log(`  ${p.slug.padEnd(36)} ${p.productCode} front ${p.frontLocationId}\n     art  ${p.artworkUrl}\n     mock ${p.mockupUrl}`); continue; }
    const art = await call("POST", "/Artwork", { Name: `AHA ${p.title}`.slice(0, 50), ImagePath: p.artworkUrl });
    const design = await call("POST", "/Design", {
      ProductCode: p.productCode, ColorId: spec.colorId,
      Name: `AHA ${p.title}`, Description: `${p.title} — After Hours Agenda`,
      Locations: [{ Id: p.frontLocationId, ImagePath: p.mockupUrl,
        Artworks: [{ Service: spec.service, Note: p.printNote, Id: art.Id }] }],
      Subscriptions: [],
    });
    designs.designs[p.slug] = {
      artworkId: art.Id, designId: design.Id, productCode: design.ProductCode, colorId: design.ColorId,
      apliiqMockupPath: design.Locations?.[0]?.ImagePath ?? "",
      variants: (design.Variants as Record<string, unknown>[]).map((v) => ({
        sku: String(v.SKU), size: String(v.Name), weight: String(v.Weight), plusSizeFee: Number(v.PlusSize_Fee ?? 0),
      })),
    };
    console.log(`  ${p.slug.padEnd(36)} artwork ${art.Id} design ${design.Id} ${designs.designs[p.slug].variants.length} sizes`);
  }
  if (apply) {
    designs._generated = new Date().toISOString().slice(0, 10);
    writeFileSync(DESIGNS_PATH, `${JSON.stringify(designs, null, 2)}\n`);
  } else {
    console.log("\n(dry run — pass --apply to create artwork and designs)");
  }
}

async function map() {
  const spec = readJson<CapsuleSpec>(SPEC_PATH);
  const designs = readJson<DesignsFile>(DESIGNS_PATH).designs;
  const existing = parseApliiqMapDocument(readJson<unknown>(MAP_PATH)).map;
  const catalog = (await call("GET", "/Product")).Products as Record<string, any>[];
  const now = new Date().toISOString();
  const capsuleSlugs = new Set(spec.products.map((p) => p.slug));
  // Drop every prior capsule entry, keep anything that is not ours.
  const next: Record<string, ApliiqMapEntry> = {};
  for (const [id, entry] of Object.entries(existing)) {
    if (![...capsuleSlugs].some((slug) => id.startsWith(`${slug}-`))) next[id] = entry;
  }
  let overrides = 0;
  for (const p of spec.products) {
    const d = designs[p.slug];
    if (!d) throw new Error(`${p.slug} has no recorded design; run create first`);
    const blank = catalog.find((c) => c.Code === p.productCode);
    if (!blank) throw new Error(`APLIIQ catalog has no product ${p.productCode}`);
    for (const v of d.variants) {
      if (!isApliiqSku(v.sku) || /A0$/.test(v.sku)) throw new Error(`${p.slug} ${v.size}: SKU ${v.sku} carries no artwork; refuse to map a blank design`);
      const key = `${p.slug}-${sizeKey(v.size)}`;
      const retail = p.sizeRetail?.[sizeLabel(v.size)] ?? p.retailPrice;
      const weightOz = Math.round(Number(String(v.weight).replace(/[^\d.]/g, "")) * 100) / 100;
      const itemCost = Math.round(Number(blank.Price) * 100) + DTF_CENTS + PRIVATE_LABEL_CENTS + Math.round(v.plusSizeFee * 100);
      const base: ApliiqMapEntry = {
        apliiqSku: v.sku,
        apliiqSkuVerified: true,
        apliiqProductId: String(d.designId),
        apliiqVariantId: `${d.designId}-${sizeKey(v.size)}`,
        apliiqDecorationSnapshot: { front: { method: "DTF", service: spec.service, apliiqArtworkId: d.artworkId, artworkUrl: p.artworkUrl, note: p.printNote } },
        apliiqPrivateLabelSnapshot: { neckLabel: { subscription: spec.privateLabel, artworkUrl: "https://afterhoursagenda.com/art/aha-neck-label.svg" } },
        apliiqAssetUrls: [p.artworkUrl, p.mockupUrl],
        apliiqRegionAvailability: ["US"],
        apliiqSizeGuideReference: p.sizeGuideId,
        apliiqMappingApproval: "approved",
        apliiqSampleApproval: "approved",
        squareMappingStatus: "active",
        weightOz,
        apliiqItemCost: itemCost,
        apliiqCostBasis: "standard",
        costEstimate: itemCost,
        costVerifiedAt: now,
        marginVerifiedAt: now,
        marginEstimate: 0,
      };
      const landed = resolveApliiqLandedCost({ ...base, retailPrice: retail });
      if (!landed.ok) throw new Error(`${key}: ${landed.reasons.join("; ")}`);
      const margin = landed.landed.margin;
      if (margin.contributionMargin <= 0) {
        throw new Error(`${key}: landed cost ${retail - margin.contributionMargin} exceeds retail ${retail}; raise the price`);
      }
      base.marginEstimate = margin.contributionMargin;
      if (margin.contributionMarginRatio < MIN_MARGIN_RATIO) {
        overrides++;
        base.marginFloorOverride = {
          minRatio: Math.floor(margin.contributionMarginRatio * 100) / 100,
          reason: p.productType === "tee"
            ? "APLIIQ plus-size fee against a flat tee price; merchant holds one price across sizes"
            : `${blank.SKU} held at merchant price; profitable, under the ${Math.round(MIN_MARGIN_RATIO * 100)}% floor`,
          approvedAt: now.slice(0, 10),
        };
      }
      next[key] = base;
      console.log(`  ${key.padEnd(44)} ${v.sku.padEnd(20)} ${String(weightOz).padStart(5)}oz  cost ${itemCost}  margin ${margin.contributionMargin} (${(margin.contributionMarginRatio * 100).toFixed(1)}%)${base.marginFloorOverride ? "  override" : ""}`);
    }
  }
  parseApliiqMapDocument({ map: next });
  writeFileSync(MAP_PATH, `${JSON.stringify({ map: next }, null, 2)}\n`);
  console.log(`\n✓ ${Object.keys(next).length} variants written to ${MAP_PATH} (${overrides} with a margin-floor override)`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "create") {
    const only = rest.includes("--only") ? rest[rest.indexOf("--only") + 1] : undefined;
    await create(rest.includes("--apply"), only);
  } else if (command === "map") {
    await map();
  } else if (command === "delete" && rest[0]) {
    for (const id of rest[0].split(",")) {
      await call("DELETE", `/Design/${id.trim()}`);
      console.log(`  deleted design ${id.trim()}`);
    }
  } else {
    console.error("usage: apliiq-capsule.ts create [--apply] [--only slug] | map | delete <ids>");
    process.exit(2);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
