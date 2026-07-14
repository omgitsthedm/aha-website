// TEMPORARY maintenance endpoint — David-approved catalog repricing
// (2026-07-13 "use suggested"). Updates Square item-variation prices for the
// 19 draft products being activated. Guarded by OPS_MAINTENANCE_KEY; returns
// 404 when the key env is absent. The price map is hardcoded so a leaked key
// could only ever apply this exact approved change. Remove after use.
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { squareRequest } from "@/lib/square/client";

export const dynamic = "force-dynamic";

// slug -> approved retail price in cents (whole product; all sizes)
const APPROVED_PRICES: Record<string, number> = {
  "zebra-unisex-knitted-cardigan": 8600,
  "dots-unisex-knitted-crewneck-sweater": 7700,
  "royal-black-unisex-hoodie": 6300,
  "nys-ecto-black-unisex-hoodie": 6300,
  "avenue-b-new-york-grey-unisex-hoodie": 6100,
  "dont-fuck-fascists-unisex-hoodie": 5400,
  "super-bros-black-short-sleeve-t-shirt": 4900,
  "keano": 4900,
  "nys-ecto-black-short-sleeve-t-shirt": 4900,
  "link-s-lawn-service-white-unisex-short-sleeve-t-shirt": 4700,
  "dont-fuck-fascists-sweatshirt": 4700,
  "yellow-reversible-bucket-hat": 4100,
  "counting-sheep-tote-bag-large-with-pocket": 4100,
  "dont-fuck-fascists-shirt": 3900,
  "library-tote-bag": 3800,
  "black-sheep-black-grey-or-white-comfy-socks": 3700,
  "counting-sheep-tote-bag-regular": 2800,
  "hope-and-tomorrow-dark-grey-cuffed-beanie": 2600,
  "hope-and-tomorrow-red-cuffed-beanie": 2600,
};

interface SquareCatalogObject {
  id: string;
  type: string;
  version?: number;
  item_variation_data?: { price_money?: { amount?: number; currency?: string } };
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const key = process.env.OPS_MAINTENANCE_KEY;
  if (!key) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("x-maintenance-key") !== key) return new NextResponse("Not found", { status: 404 });

  const dryRun = new URL(request.url).searchParams.get("dry") !== "false";

  const manifest = JSON.parse(readFileSync(join(process.cwd(), "data/product-manifest.json"), "utf8")) as {
    products: { slug: string; variants: { ahaVariantId: string }[] }[];
  };
  const squareMapDoc = JSON.parse(readFileSync(join(process.cwd(), "data/square-map.json"), "utf8")) as {
    map: Record<string, { squareVariationId?: string }>;
  };

  // slug -> variation ids
  const targets: { slug: string; priceCents: number; variationIds: string[] }[] = [];
  for (const [slug, priceCents] of Object.entries(APPROVED_PRICES)) {
    const product = manifest.products.find((p) => p.slug === slug);
    if (!product) continue;
    const variationIds = product.variants
      .map((v) => squareMapDoc.map[v.ahaVariantId]?.squareVariationId)
      .filter((id): id is string => Boolean(id));
    if (variationIds.length > 0) targets.push({ slug, priceCents, variationIds });
  }

  const allIds = targets.flatMap((t) => t.variationIds);
  const retrieved = await squareRequest<{ objects?: SquareCatalogObject[] }>(
    "/catalog/batch-retrieve",
    { method: "POST", body: { object_ids: allIds, include_related_objects: false }, revalidate: 0 }
  );
  const byId = new Map((retrieved.objects || []).map((o) => [o.id, o]));

  const plan: { slug: string; variationId: string; oldAmount?: number; newAmount: number; found: boolean }[] = [];
  const toUpsert: SquareCatalogObject[] = [];
  for (const target of targets) {
    for (const variationId of target.variationIds) {
      const obj = byId.get(variationId);
      const oldAmount = obj?.item_variation_data?.price_money?.amount;
      plan.push({ slug: target.slug, variationId, oldAmount, newAmount: target.priceCents, found: Boolean(obj) });
      if (obj && obj.item_variation_data) {
        toUpsert.push({
          ...obj,
          item_variation_data: {
            ...obj.item_variation_data,
            price_money: { amount: target.priceCents, currency: "USD" },
          },
        });
      }
    }
  }

  if (!dryRun && toUpsert.length > 0) {
    // Square batch upsert: send in one batch (well under the 1000 limit)
    await squareRequest("/catalog/batch-upsert", {
      method: "POST",
      body: {
        idempotency_key: randomUUID(),
        batches: [{ objects: toUpsert }],
      },
      revalidate: 0,
    });
  }

  return NextResponse.json({
    dryRun,
    products: targets.length,
    variations: plan.length,
    missing: plan.filter((p) => !p.found).length,
    applied: dryRun ? 0 : toUpsert.length,
    plan,
  });
}
