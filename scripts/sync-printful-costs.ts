import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { estimatePrintfulVariantCost, type PrintfulVariantPriceData } from "@/lib/commerce/margin";
import type { AhaProduct, AhaVariant } from "@/lib/types/product";

const dryRun = process.argv.includes("--dry-run");
const refresh = process.argv.includes("--refresh");
const limitIndex = process.argv.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : Number.POSITIVE_INFINITY;
const token = process.env.PRINTFUL_API_TOKEN;
const storeId = process.env.PRINTFUL_STORE_ID;
if (!token) throw new Error("PRINTFUL_API_TOKEN is required; the value is never printed.");

const mapPath = "data/printful-v2-map.json";
const snapshotPath = "data/printful-cost-snapshots.json";
const manifest = JSON.parse(readFileSync("data/product-manifest.json", "utf8")) as { products: AhaProduct[] };
const mapDoc = JSON.parse(readFileSync(mapPath, "utf8")) as {
  map: Record<string, {
    printfulCatalogVariantId?: number;
    printfulPlacements?: AhaVariant["printfulPlacements"];
    costEstimate?: number;
    costCurrency?: string;
    costVerifiedAt?: string;
  }>;
};

const snapshot = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, "utf8")) as {
      generatedAt?: string;
      variants: Record<string, PrintfulVariantPriceData>;
      errors?: Record<string, string>;
    }
  : { variants: {} as Record<string, PrintfulVariantPriceData>, errors: {} as Record<string, string> };

const activeVariantIds = new Set<string>();
for (const product of manifest.products) {
  if (product.status !== "active") continue;
  for (const variant of product.variants) if (variant.status === "active") activeVariantIds.add(variant.ahaVariantId);
}

const catalogIds = Array.from(new Set(
  Array.from(activeVariantIds).map((id) => mapDoc.map[id]?.printfulCatalogVariantId).filter(Boolean)
)) as number[];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPrice(id: number): Promise<PrintfulVariantPriceData> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`https://api.printful.com/v2/catalog-variants/${id}/prices`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
      },
    });
    if (response.status === 429) {
      await wait((Number(response.headers.get("retry-after")) || 5) * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).data as PrintfulVariantPriceData;
  }
  throw new Error("rate-limit retries exhausted");
}

async function main() {
  console.log(`Printful cost sync: ${catalogIds.length} active catalog variant(s); dryRun=${dryRun}; refresh=${refresh}`);
  let fetched = 0;
  for (const id of catalogIds) {
    if (fetched >= limit) break;
    if (!refresh && snapshot.variants[String(id)]) continue;
    try {
      snapshot.variants[String(id)] = await fetchPrice(id);
      delete snapshot.errors?.[String(id)];
    } catch (error) {
      snapshot.errors ??= {};
      snapshot.errors[String(id)] = error instanceof Error ? error.message : "unknown error";
    }
    fetched++;
    if (fetched % 20 === 0 || fetched === Math.min(catalogIds.length, limit)) {
      console.log(`  fetched ${fetched}/${Math.min(catalogIds.length, limit)}`);
    }
    await wait(550); // stay under Printful's documented 120 requests/minute limit
  }

  const verifiedAt = new Date().toISOString();
  let estimated = 0;
  let unresolved = 0;
  for (const variantId of Array.from(activeVariantIds)) {
    const entry = mapDoc.map[variantId];
    const catalogId = entry?.printfulCatalogVariantId;
    const price = catalogId ? snapshot.variants[String(catalogId)] : undefined;
    if (!entry || !price) { unresolved++; continue; }
    const cost = estimatePrintfulVariantCost(price, entry.printfulPlacements ?? []);
    if (cost == null) { unresolved++; continue; }
    entry.costEstimate = cost;
    entry.costCurrency = price.currency;
    entry.costVerifiedAt = verifiedAt;
    estimated++;
  }

  console.log(`  estimated active variants=${estimated}; unresolved=${unresolved}; API errors=${Object.keys(snapshot.errors ?? {}).length}`);
  if (!dryRun) {
    snapshot.generatedAt = verifiedAt;
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    writeFileSync(mapPath, `${JSON.stringify(mapDoc, null, 2)}\n`);
    console.log(`  wrote ${snapshotPath} and ${mapPath}`);
  }
  if (unresolved > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
