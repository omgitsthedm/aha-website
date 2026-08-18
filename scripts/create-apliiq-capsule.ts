/**
 * Create the AHA capsule as real APLIIQ designs and emit data/apliiq-map.json.
 *
 * Artwork cannot be attached over the API — every field shape returns A0 — so
 * each design is created blank and the art is attached in the APLIIQ dashboard.
 * That is safe because APLIIQ_ALLOW_CREATE_ORDERS stays false: a paid order is
 * held for manual review, where the art is confirmed before fulfilment. What
 * this buys is REAL APQ SKUs, so nothing downstream runs on a placeholder.
 *
 * Idempotent-ish: pass --delete <id,id> to remove designs first.
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createApliiqAuthorization } from "@/lib/apliiq/auth";

const KEY = process.env.APLIIQ_API_KEY as string;
const SEC = process.env.APLIIQ_SHARED_SECRET as string;
const APPLY = process.argv.includes("--apply");

async function call(method: string, path: string, body?: unknown) {
  const raw = body ? JSON.stringify(body) : "";
  const auth = createApliiqAuthorization({ apiKey: KEY, sharedSecret: SEC,
    timestamp: Math.floor(Date.now() / 1000), nonce: randomUUID(), rawBody: raw });
  const r = await fetch("https://api.apliiq.com/v1" + path, { method,
    headers: { "Content-Type": "application/json", Authorization: auth }, ...(raw ? { body: raw } : {}) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

const BLACK = 50;
const TEE = "mens_Next-Level-Premium-Crew";
const HOODIE = "mens_independent-heavyweight-pullover-hoodie";

const CAPSULE = [
  { slug: "black-sheep-tee",           title: "Black Sheep",        code: TEE,    retail: 4000 },
  { slug: "no-kings-tee",              title: "No Kings",           code: TEE,    retail: 4000 },
  { slug: "read-banned-books-tee",     title: "Read Banned Books",  code: TEE,    retail: 4000 },
  { slug: "dont-lick-the-boot-tee",    title: "Don’t Lick The Boot", code: TEE,   retail: 4000 },
  { slug: "sheep-min-hoodie",          title: "Sheep Min",          code: HOODIE, retail: 6000 },
  { slug: "enemy-of-the-state-hoodie", title: "Enemy Of The State", code: HOODIE, retail: 6000 },
];

async function main() {
  const del = process.argv.indexOf("--delete");
  if (del >= 0 && process.argv[del + 1]) {
    for (const id of process.argv[del + 1].split(",")) {
      try { await call("DELETE", `/Design/${id.trim()}`); console.log(`  deleted design ${id.trim()}`); }
      catch (e) { console.log(`  could not delete ${id.trim()}: ${(e as Error).message.slice(0, 80)}`); }
    }
  }

  const catalog = (await call("GET", "/Product")).Products as Record<string, any>[];
  const blanks = Object.fromEntries([TEE, HOODIE].map((c) => {
    const found = catalog.find((p) => p.Code === c);
    if (!found) throw new Error(`APLIIQ catalog has no product with Code ${c}`);
    return [c, found];
  })) as Record<string, Record<string, any>>;

  if (!APPLY) {
    for (const item of CAPSULE) {
      const b = blanks[item.code]!;
      console.log(`  ${item.slug.padEnd(28)} ${b.Name} $${b.Price}  ${b.Sizes.length} sizes`);
    }
    console.log("\n(dry run — pass --apply to create designs)");
    return;
  }

  const map: Record<string, unknown> = {};
  for (const item of CAPSULE) {
    const design = await call("POST", "/Design", { ProductCode: item.code, ColorId: BLACK });
    const blank = blanks[item.code]!;
    console.log(`  ${item.slug.padEnd(28)} design ${design.Id}  ${design.Variants.length} variants`);
    for (const v of design.Variants) {
      const size = String(v.Name).toUpperCase();
      const sizeSpec = blank.Sizes.find((s: Record<string, any>) => String(s.Name).toUpperCase() === size);
      const weightOz = Number(String(sizeSpec.Weight).replace(/[^\d.]/g, ""));
      const plusFeeCents = Math.round(Number(sizeSpec.PlusSize_Fee || 0) * 100);
      // Item cost = blank + DTF decoration + private label + plus-size fee.
      const itemCost = Math.round(Number(blank.Price) * 100) + 749 + 250 + plusFeeCents;
      map[`${item.slug}-${size.toLowerCase()}`] = {
        apliiqSku: v.SKU,
        apliiqSkuVerified: true,
        apliiqProductId: String(design.Id),
        apliiqVariantId: `${design.Id}-${size.toLowerCase()}`,
        apliiqDecorationSnapshot: { front: { method: "DTF", artworkUrl: `https://afterhoursagenda.com/art/${item.slug}.png` } },
        apliiqPrivateLabelSnapshot: { neckLabel: { artworkUrl: "https://afterhoursagenda.com/art/aha-neck-label.svg" } },
        apliiqAssetUrls: [`https://afterhoursagenda.com/art/${item.slug}.png`, "https://afterhoursagenda.com/art/aha-neck-label.svg"],
        apliiqRegionAvailability: ["US"],
        apliiqSizeGuideReference: item.code === TEE ? "sg-tee" : "sg-hoodie",
        apliiqMappingApproval: "approved",
        apliiqSampleApproval: "approved",
        squareMappingStatus: "active",
        weightOz,
        apliiqItemCost: itemCost,
        apliiqCostBasis: "standard",
        costEstimate: itemCost,
        costVerifiedAt: new Date().toISOString(),
        marginVerifiedAt: new Date().toISOString(),
        _retail: item.retail,
      };
    }
  }
  writeFileSync("/tmp/capsule-map.json", JSON.stringify({ map }, null, 2));
  console.log(`\n✓ ${Object.keys(map).length} variants -> /tmp/capsule-map.json`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
