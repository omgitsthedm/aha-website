// TEMPORARY maintenance endpoint — parked-item recovery (David-approved
// "use suggested" pricing policy, 2026-07-13). Two actions:
//   ?action=inspect — READ-ONLY batch-retrieve of the target Square
//     variations: existence, item ids, current prices.
//   ?action=apply  — set the approved prices on those variations.
// Guarded by OPS_MAINTENANCE_KEY (404 when unset). Targets are hardcoded so
// a leaked key could only apply this exact change. Remove after use.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { squareRequest } from "@/lib/square/client";

export const dynamic = "force-dynamic";

const TARGETS: { variationId: string; priceCents: number }[] = [
  { variationId: "7RTLTZHEAWXTOSQUY4T5N2N3", priceCents: 3700 },
  { variationId: "BCUPQUW6NV34YUAZF2LNAQCQ", priceCents: 1100 },
  { variationId: "MIHHW65I2UOUL65LPWR27LW7", priceCents: 600 },
  { variationId: "AZF2JKDGFC2SK5J3OW4ZSQ4G", priceCents: 600 },
  { variationId: "3R77OSW7UHCHIJQZRTUFQNPU", priceCents: 600 },
  { variationId: "AT2SS3NUQ7LX3ZUZY7JE24I7", priceCents: 1100 },
  { variationId: "MYCCE6D7BAUGIJ3VEH2ODFSS", priceCents: 3800 },
  { variationId: "KC2SWRN4TMRJZ5NKNSLZRZ7F", priceCents: 3800 },
  { variationId: "OF6XP4MP7ALXB6LBI4G4226J", priceCents: 3800 },
  { variationId: "T4CPFF6FYG3CDOUGFVHH2DCT", priceCents: 3800 },
  { variationId: "JLB72NNRS5FAV7PXEPN6SDAE", priceCents: 3400 },
  { variationId: "HG5WBTG54A4TGMXDMTSTJX3N", priceCents: 4600 },
  { variationId: "UCF4TDRCJASV7SG3KFN2XGMV", priceCents: 4600 },
  { variationId: "GZZHLVAKIF3GJ4KIE737C732", priceCents: 4600 },
  { variationId: "YCDDCZV3SLGMUFT5QE37Y7ST", priceCents: 4600 },
  { variationId: "INDHQ5WJBC36NVAAMYTXMPTN", priceCents: 4600 },
  { variationId: "2HKUIRXGBCO2XM7XBFRKPUUA", priceCents: 4600 },
  { variationId: "PFI62DFJ4TVTDYIOJB7VKOD2", priceCents: 3800 },
  { variationId: "SYHXOD7MO63VRWX4WH72NMBO", priceCents: 3800 },
];

interface SquareCatalogObject {
  id: string;
  type: string;
  version?: number;
  item_variation_data?: { item_id?: string; name?: string; price_money?: { amount?: number; currency?: string } };
  [key: string]: unknown;
}

export async function POST(request: Request) {
  const key = process.env.OPS_MAINTENANCE_KEY;
  if (!key) return new NextResponse("Not found", { status: 404 });
  if (request.headers.get("x-maintenance-key") !== key) return new NextResponse("Not found", { status: 404 });

  const action = new URL(request.url).searchParams.get("action") || "inspect";
  const retrieved = await squareRequest<{ objects?: SquareCatalogObject[] }>(
    "/catalog/batch-retrieve",
    { method: "POST", body: { object_ids: TARGETS.map((t) => t.variationId), include_related_objects: false }, revalidate: 0 }
  );
  const byId = new Map((retrieved.objects || []).map((o) => [o.id, o]));

  const plan = TARGETS.map((t) => {
    const obj = byId.get(t.variationId);
    return {
      variationId: t.variationId,
      found: Boolean(obj),
      itemId: obj?.item_variation_data?.item_id,
      variationName: obj?.item_variation_data?.name,
      oldAmount: obj?.item_variation_data?.price_money?.amount,
      newAmount: t.priceCents,
    };
  });

  let applied = 0;
  if (action === "apply") {
    const toUpsert: SquareCatalogObject[] = [];
    for (const t of TARGETS) {
      const obj = byId.get(t.variationId);
      if (obj?.item_variation_data) {
        toUpsert.push({ ...obj, item_variation_data: { ...obj.item_variation_data, price_money: { amount: t.priceCents, currency: "USD" } } });
      }
    }
    if (toUpsert.length > 0) {
      await squareRequest("/catalog/batch-upsert", {
        method: "POST",
        body: { idempotency_key: randomUUID(), batches: [{ objects: toUpsert }] },
        revalidate: 0,
      });
      applied = toUpsert.length;
    }
  }

  return NextResponse.json({ action, targets: TARGETS.length, found: plan.filter((p) => p.found).length, applied, plan });
}
