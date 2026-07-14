// Protected ops endpoint: create a Square catalog item (sizes, prices, images)
// for the product factory. Runs inside production where Square credentials
// live, because local environments cannot read Netlify's secret values.
//
// Guarded by OPS_MAINTENANCE_KEY (404 when unset). Creation-only by design:
// it never updates or deletes existing catalog objects, and it refuses names
// that already exist unless allowDuplicateName is set.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { squareRequest } from "@/lib/square/client";

export const dynamic = "force-dynamic";

interface CreateVariationSpec {
  name: string; // customer-facing size, e.g. "M"
  priceCents: number;
  sku?: string;
}

interface CreateItemBody {
  name: string;
  description?: string;
  variations: CreateVariationSpec[];
  imageUrls?: string[];
  allowDuplicateName?: boolean;
  dryRun?: boolean;
}

interface SquareObject {
  id: string;
  type: string;
  item_data?: { name?: string; variations?: { id: string; item_variation_data?: { name?: string } }[] };
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const key = process.env.OPS_MAINTENANCE_KEY;
  if (!key) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("x-maintenance-key") !== key) return new NextResponse("Not found", { status: 404 });

  let body: CreateItemBody;
  try {
    body = (await request.json()) as CreateItemBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name || !Array.isArray(body.variations) || body.variations.length === 0) {
    return NextResponse.json({ ok: false, error: "name and variations are required" }, { status: 400 });
  }
  if (body.variations.some((v) => !v.name || !(v.priceCents > 0))) {
    return NextResponse.json({ ok: false, error: "every variation needs a name and a positive priceCents" }, { status: 400 });
  }

  // Refuse silent duplicates: exact-name search first.
  const search = await squareRequest<{ objects?: SquareObject[] }>("/catalog/search", {
    method: "POST",
    body: {
      object_types: ["ITEM"],
      query: { exact_query: { attribute_name: "name", attribute_value: body.name } },
    },
    revalidate: 0,
  });
  const existing = (search.objects || []).filter((o) => !("is_deleted" in o && o.is_deleted));
  if (existing.length > 0 && !body.allowDuplicateName) {
    return NextResponse.json({
      ok: false,
      error: `An item named "${body.name}" already exists (${existing.map((o) => o.id).join(", ")})`,
    }, { status: 409 });
  }

  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, wouldCreate: { name: body.name, variations: body.variations.length, images: body.imageUrls?.length ?? 0 } });
  }

  // Create item + variations in one upsert.
  const itemTempId = "#item";
  const upsert = await squareRequest<{ catalog_object?: SquareObject; id_mappings?: { client_object_id: string; object_id: string }[] }>(
    "/catalog/object",
    {
      method: "POST",
      body: {
        idempotency_key: randomUUID(),
        object: {
          type: "ITEM",
          id: itemTempId,
          item_data: {
            name: body.name,
            description: body.description,
            variations: body.variations.map((v, i) => ({
              type: "ITEM_VARIATION",
              id: `#variation${i}`,
              item_variation_data: {
                name: v.name,
                sku: v.sku,
                pricing_type: "FIXED_PRICING",
                price_money: { amount: v.priceCents, currency: "USD" },
              },
            })),
          },
        },
      },
      revalidate: 0,
    }
  );

  const created = upsert.catalog_object;
  if (!created?.id) {
    return NextResponse.json({ ok: false, error: "Square did not return a created item" }, { status: 502 });
  }
  const variationIds: Record<string, string> = {};
  for (const variation of created.item_data?.variations || []) {
    if (variation.item_variation_data?.name) variationIds[variation.item_variation_data.name] = variation.id;
  }

  // Attach images: fetch each URL and multipart-upload to Square.
  const imageIds: string[] = [];
  const imageErrors: string[] = [];
  for (const [index, url] of (body.imageUrls || []).entries()) {
    try {
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) throw new Error(`fetch ${imageResponse.status}`);
      const blob = await imageResponse.blob();
      const form = new FormData();
      form.append("request", JSON.stringify({
        idempotency_key: randomUUID(),
        object_id: created.id,
        is_primary: index === 0,
        image: { type: "IMAGE", id: "#image", image_data: { name: `${body.name} ${index + 1}` } },
      }));
      form.append("image_file", blob, `image-${index + 1}.webp`);
      const token = process.env.SQUARE_ACCESS_TOKEN;
      const base = process.env.SQUARE_ENVIRONMENT === "sandbox"
        ? "https://connect.squareupsandbox.com"
        : "https://connect.squareup.com";
      const imgRes = await fetch(`${base}/v2/catalog/images`, {
        method: "POST",
        headers: {
          "Square-Version": process.env.SQUARE_API_VERSION || "2024-01-18",
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      const imgJson = (await imgRes.json()) as { image?: { id?: string }; errors?: unknown[] };
      if (!imgRes.ok || !imgJson.image?.id) throw new Error(`upload ${imgRes.status}`);
      imageIds.push(imgJson.image.id);
    } catch (error) {
      imageErrors.push(`${url}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    itemId: created.id,
    variationIds,
    imageIds,
    imageErrors,
  });
}
