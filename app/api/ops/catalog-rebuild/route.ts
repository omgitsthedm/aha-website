// TEMPORARY maintenance endpoint — sheep product rebuild, step 1 of 2
// (David-directed 2026-07-14: delete the old Square + Printful items, then
// build new ones and push to Square).
//
// action=inspect  → READ-ONLY: verify the 7 old Square items still exist
// action=delete   → batch-delete those Square items (storefront drops them
//                   until the factory rebuild recreates them — step 2 runs
//                   scripts/rebuild-sheep-products.mjs)
//
// Item ids come from data/sheep-rebuild-snapshot.json (committed print DNA).
// Guarded by OPS_MAINTENANCE_KEY; 404 when unset. Remove after use.
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
