// TEMPORARY maintenance endpoint — old-sheep eradication in Square (David-
// approved 2026-07-14: "no Black Sheep anywhere unless it's the new design").
// For each hardcoded sheep product: uploads the new clean-sheep mockup as the
// item's image and sets it as the ONLY image (old grainy renders detached).
// Guarded by OPS_MAINTENANCE_KEY; 404 when unset. Remove after use.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { squareRequest } from "@/lib/square/client";

export const dynamic = "force-dynamic";

// slug -> new image path (served by this site)
const TARGETS: Record<string, string> = {
  "black-sheep-bone-unisex-premium-sweatshirt": "/products/black-sheep-bone-unisex-premium-sweatshirt/01-bone-unisex-premium-sweatshirt-front.webp",
  "black-sheep-mint-unisex-premium-sweatshirt": "/products/black-sheep-mint-unisex-premium-sweatshirt/01-agave-unisex-premium-sweatshirt-front.webp",
};

interface SquareObject {
  id: string;
  type: string;
  version?: number;
  item_data?: { image_ids?: string[]; [key: string]: unknown };
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const key = process.env.OPS_MAINTENANCE_KEY;
  if (!key) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("x-maintenance-key") !== key) return new NextResponse("Not found", { status: 404 });

  const dryRun = new URL(request.url).searchParams.get("dry") !== "false";
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

  const manifest = JSON.parse(readFileSync(join(process.cwd(), "data/product-manifest.json"), "utf8")) as {
    products: { slug: string; variants: { ahaVariantId: string }[] }[];
  };
  const squareMap = (JSON.parse(readFileSync(join(process.cwd(), "data/square-map.json"), "utf8")) as {
    map: Record<string, { squareCatalogObjectId?: string }>;
  }).map;

  const results: Record<string, unknown>[] = [];
  for (const [slug, imagePath] of Object.entries(TARGETS)) {
    const product = manifest.products.find((p) => p.slug === slug);
    const itemId = product?.variants.map((v) => squareMap[v.ahaVariantId]?.squareCatalogObjectId).find(Boolean);
    if (!itemId) { results.push({ slug, error: "no Square item id" }); continue; }

    const retrieved = await squareRequest<{ object?: SquareObject }>(`/catalog/object/${itemId}`, { revalidate: 0 });
    const item = retrieved.object;
    if (!item?.item_data) { results.push({ slug, error: "item not found" }); continue; }
    const oldImageIds = item.item_data.image_ids || [];

    if (dryRun) { results.push({ slug, itemId, oldImageIds, wouldUpload: `${site}${imagePath}` }); continue; }

    // 1) upload the new image attached to the item, as primary
    const imageResponse = await fetch(`${site}${imagePath}`);
    if (!imageResponse.ok) { results.push({ slug, error: `image fetch ${imageResponse.status}` }); continue; }
    const blob = await imageResponse.blob();
    const form = new FormData();
    form.append("request", JSON.stringify({
      idempotency_key: randomUUID(),
      object_id: itemId,
      is_primary: true,
      image: { type: "IMAGE", id: "#image", image_data: { name: `${slug} clean sheep` } },
    }));
    form.append("image_file", blob, "clean-sheep.webp");
    const token = process.env.SQUARE_ACCESS_TOKEN;
    const base = process.env.SQUARE_ENVIRONMENT === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
    const imgRes = await fetch(`${base}/v2/catalog/images`, {
      method: "POST",
      headers: { "Square-Version": process.env.SQUARE_API_VERSION || "2024-01-18", Authorization: `Bearer ${token}` },
      body: form,
    });
    const imgJson = (await imgRes.json()) as { image?: { id?: string } };
    if (!imgRes.ok || !imgJson.image?.id) { results.push({ slug, error: `upload ${imgRes.status}` }); continue; }

    // 2) set the new image as the item's ONLY image (detach old renders)
    const fresh = await squareRequest<{ object?: SquareObject }>(`/catalog/object/${itemId}`, { revalidate: 0 });
    const freshItem = fresh.object!;
    await squareRequest("/catalog/object", {
      method: "POST",
      body: {
        idempotency_key: randomUUID(),
        object: { ...freshItem, item_data: { ...freshItem.item_data, image_ids: [imgJson.image.id] } },
      },
      revalidate: 0,
    });
    results.push({ slug, itemId, newImageId: imgJson.image.id, detachedOldImages: oldImageIds });
  }
  return NextResponse.json({ dryRun, results });
}
