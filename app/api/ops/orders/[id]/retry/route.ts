// Ops "Retry fulfillment". It re-runs the ordinary fulfillment path, which is
// deliberately INERT on a gate-held APLIIQ claim: startApliiqFulfillment sees a
// row with no per-order hold-release authorization and returns without writing,
// without throwing and without submitting.
//
// That silence used to reach the operator as a bare 303 back to /ops with
// nothing changed — the same response a real submission produces — so a held
// order could be retried forever with no signal that the button does nothing.
// This route now looks at the claim after the run and answers with the reason.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { fulfillments } from "@/db/schema";
import { db, isDbConfigured } from "@/lib/db/client";
import { retryOrderFulfillment } from "@/lib/commerce/reconciliation";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";

export const dynamic = "force-dynamic";

interface HeldApliiqClaim {
  status: string;
  lastError: string | null;
}

/**
 * The APLIIQ claim for this order iff the run left it unmoved.
 *
 * `providerRequestId` is the decision column documented on
 * startApliiqFulfillment: NULL means no create POST was ever issued for the
 * row. Paired with a NULL `providerOrderId` — nothing lives at the provider —
 * it is proof that this retry submitted nothing, whether the row was already
 * held or the run itself re-held it because the production gates are shut.
 *
 * Read AFTER the retry on purpose. A row in this state post-run cannot be a
 * false positive: any submission the retry did perform would have stamped the
 * request id before its first remote call.
 */
async function heldApliiqClaim(orderId: number): Promise<HeldApliiqClaim | null> {
  const [row] = await db().select({
    status: fulfillments.status,
    lastError: fulfillments.lastError,
  }).from(fulfillments).where(and(
    eq(fulfillments.orderId, orderId),
    eq(fulfillments.fulfillmentProvider, "apliiq"),
    isNull(fulfillments.providerRequestId),
    isNull(fulfillments.providerOrderId),
  )).limit(1);
  return row ?? null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId < 1) return NextResponse.json({ ok: false, error: "Invalid order." }, { status: 400 });
  try { await retryOrderFulfillment(orderId); }
  catch (error) { return NextResponse.json({ ok: false, orderId, error: error instanceof Error ? error.message : "Retry failed." }, { status: 409 }); }

  // Never turn a retry that DID run into a failure because this read failed.
  let held: HeldApliiqClaim | null = null;
  if (isDbConfigured()) {
    try { held = await heldApliiqClaim(orderId); } catch { held = null; }
  }
  if (held) {
    const releaseEndpoint = `/api/ops/orders/${orderId}/apliiq-resubmit`;
    return NextResponse.json({
      ok: false,
      orderId,
      declined: "apliiq_hold",
      status: held.status,
      holdReason: held.lastError,
      releaseEndpoint,
      error: `Nothing was submitted. The APLIIQ claim for order ${orderId} is held (${held.status})${held.lastError ? `: ${held.lastError}` : ""}. Retry cannot release a hold — use "Release APLIIQ hold" (POST ${releaseEndpoint}), which authorizes exactly one submission for this order.`,
    }, { status: 409 });
  }

  return NextResponse.redirect(new URL("/ops", request.url), 303);
}
