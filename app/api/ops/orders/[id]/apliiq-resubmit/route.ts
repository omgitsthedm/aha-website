// Ops-only break-glass: resubmit an APLIIQ order the provider never received.
//
// This is NOT the retry button. Retry re-runs the ordinary fulfillment path and
// deliberately refuses to touch a claim that already carries a providerRequestId,
// because a create POST was issued for it and the outcome is unknown. This route
// is the only way past that, and it earns it by proving absence with provider
// READS before anything is released. See forceResubmitApliiqFulfillment for why
// that is the defensible reading of the client's "no safe POST retry" comment
// against docs/APLIIQ_CODEX_HANDOFF.md:405 "create-order is idempotent".
//
// It answers JSON rather than redirecting: the absence evidence is the reason to
// trust the action, so the operator has to see it.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { forceResubmitApliiqFulfillment } from "@/lib/commerce/fulfillment";
import { retryOrderFulfillment } from "@/lib/commerce/reconciliation";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId < 1) return NextResponse.json({ ok: false, error: "Invalid order." }, { status: 400 });

  let release;
  try { release = await forceResubmitApliiqFulfillment(orderId); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Force resubmit failed." }, { status: 409 }); }

  if (release.outcome === "blocked") {
    return NextResponse.json({
      ok: false,
      orderId,
      error: release.reason,
      ...(release.providerOrderId ? { providerOrderId: release.providerOrderId } : {}),
    }, { status: 409 });
  }

  // The claim is released; the ordinary path now re-derives the identical
  // providerRequestId and submits once. A failure here still leaves a durable,
  // audited row, so report it instead of retrying.
  try { await retryOrderFulfillment(orderId); }
  catch (error) {
    return NextResponse.json({
      ok: false,
      orderId,
      released: true,
      providerRequestId: release.providerRequestId,
      evidence: release.evidence,
      error: error instanceof Error ? error.message : "Resubmission failed after the claim was released.",
    }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    orderId,
    providerRequestId: release.providerRequestId,
    evidence: release.evidence,
  });
}
