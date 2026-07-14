// TEMPORARY maintenance endpoint — sheep product rebuild, step 1 of 2
// (David-directed 2026-07-14: delete the old Square + Printful items, then
// build new ones and push to Square).
//
// action=inspect  → READ-ONLY: verify the 7 old Square items still exist
// action=delete   → batch-delete those Square items (storefront drops them
//                   until the factory rebuild recreates them — step 2 runs
//                   scripts/rebuild-sheep-products.mjs)
// action=attach   → attach mockup images to an EXISTING item (step 3: the
//                   rebuild creates items imageless, and the storefront
//                   hides items with no Square image). Body:
//                   { itemId, name, imageUrls: [] }
//
// Item ids come from data/sheep-rebuild-snapshot.json (committed print DNA).
// Guarded by OPS_MAINTENANCE_KEY; 404 when unset. Remove after use.
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { squareRequest } from "@/lib/square/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = process.env.OPS_MAINTENANCE_KEY;
  if (!key) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("x-maintenance-key") !== key) return new NextResponse("Not found", { status: 404 });

  const action = new URL(request.url).searchParams.get("action") || "inspect";

  // READ-ONLY: fetch any catalog object (item + variations) for map repair.
  if (action === "object") {
    const body = await request.json().catch(() => ({})) as { objectId?: string };
    if (!body.objectId) return NextResponse.json({ ok: false, error: "objectId required" }, { status: 400 });
    const res = await squareRequest<{ object?: unknown }>(`/catalog/object/${body.objectId}`, { revalidate: 0 });
    return NextResponse.json({ ok: true, object: res.object ?? null });
  }

  if (action === "attach") {
    const body = await request.json().catch(() => ({})) as { itemId?: string; name?: string; imageUrls?: string[] };
    if (!body.itemId || !Array.isArray(body.imageUrls) || body.imageUrls.length === 0) {
      return NextResponse.json({ ok: false, error: "itemId and imageUrls required" }, { status: 400 });
    }
    const token = process.env.SQUARE_ACCESS_TOKEN;
    const base = process.env.SQUARE_ENVIRONMENT === "sandbox"
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";
    const imageIds: string[] = [];
    const imageErrors: string[] = [];
    for (const [index, url] of body.imageUrls.entries()) {
      try {
        const imageResponse = await fetch(url);
        if (!imageResponse.ok) throw new Error(`fetch ${imageResponse.status}`);
        const blob = await imageResponse.blob();
        const form = new FormData();
        form.append("request", JSON.stringify({
          idempotency_key: randomUUID(),
          object_id: body.itemId,
          is_primary: index === 0,
          image: { type: "IMAGE", id: "#image", image_data: { name: `${body.name || body.itemId} ${index + 1}` } },
        }));
        form.append("image_file", blob, `image-${index + 1}.jpg`);
        const imgRes = await fetch(`${base}/v2/catalog/images`, {
          method: "POST",
          headers: {
            "Square-Version": process.env.SQUARE_API_VERSION || "2024-01-18",
            Authorization: `Bearer ${token}`,
          },
          body: form,
        });
        const imgJson = (await imgRes.json()) as { image?: { id?: string } };
        if (!imgRes.ok || !imgJson.image?.id) throw new Error(`upload ${imgRes.status}`);
        imageIds.push(imgJson.image.id);
      } catch (error) {
        imageErrors.push(`${url}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    return NextResponse.json({ ok: imageErrors.length === 0, action, itemId: body.itemId, imageIds, imageErrors });
  }

  const snapshot = JSON.parse(readFileSync(join(process.cwd(), "data/sheep-rebuild-snapshot.json"), "utf8")) as Record<string, { squareItemId?: string | null; title: string }>;

  const targets = Object.entries(snapshot)
    .filter(([, s]) => s.squareItemId)
    .map(([slug, s]) => ({ slug, itemId: s.squareItemId as string, title: s.title }));

  const retrieved = await squareRequest<{ objects?: { id: string; is_deleted?: boolean }[] }>(
    "/catalog/batch-retrieve",
    { method: "POST", body: { object_ids: targets.map((t) => t.itemId) }, revalidate: 0 }
  );
  const found = new Set((retrieved.objects || []).filter((o) => !o.is_deleted).map((o) => o.id));
  const plan = targets.map((t) => ({ ...t, exists: found.has(t.itemId) }));

  if (action === "delete") {
    const ids = plan.filter((p) => p.exists).map((p) => p.itemId);
    if (ids.length > 0) {
      const res = await squareRequest<{ deleted_object_ids?: string[] }>(
        "/catalog/batch-delete",
        { method: "POST", body: { object_ids: ids }, revalidate: 0 }
      );
      return NextResponse.json({ action, deleted: res.deleted_object_ids?.length ?? 0, deletedIds: res.deleted_object_ids, plan });
    }
  }
  return NextResponse.json({ action, plan });
}
