// Ops "Acknowledge attention" (audit HIGH 7's other half).
//
// `fulfillments.attention_at` / `attention_reason` are a flag, not a state, and
// the two automatic clears only reach the holds they can still see: the sweep
// retires a hold that has lifted, a shipped callback retires one its own
// progress supersedes. Everything else — money owed on a cancelled line, a SKU
// that matched no paid line — is nobody's to clear but a human's, and until
// this route existed the only way to do it was SQL. So the honest act left no
// trace and the dishonest one (ignore the row) left the queue permanently red.
//
// Guarded by the ops session cookie and 404s like every other ops route, so an
// unauthenticated caller cannot even learn the endpoint exists.
//
// Answers JSON rather than redirecting because acknowledgeApliiqAttention
// reports exactly which reasons it retired, and an operator dismissing a flag
// should be shown what they just dismissed. The ops page renders that body in
// place; without scripting it is still on screen, just unstyled.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { acknowledgeApliiqAttention } from "@/lib/commerce/apliiq-webhook-events";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) return new NextResponse("Not found", { status: 404 });
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId < 1) return NextResponse.json({ ok: false, error: "Invalid order." }, { status: 400 });

  let acknowledged;
  try { acknowledged = await acknowledgeApliiqAttention(orderId); }
  catch (error) {
    return NextResponse.json({
      ok: false,
      orderId,
      error: error instanceof Error ? error.message : "Acknowledge failed.",
    }, { status: 409 });
  }

  // The acknowledger is idempotent and reports 0 rather than raising, which is
  // right for it and wrong to pass on as success: the operator would be sent
  // back to a page still showing the flag they thought they had just cleared.
  if (acknowledged.cleared === 0) {
    return NextResponse.json({
      ok: false,
      orderId,
      cleared: 0,
      error: `Nothing to acknowledge on order ${orderId}: no APLIIQ fulfillment row is currently flagged for attention.`,
    }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    orderId,
    cleared: acknowledged.cleared,
    // What was dismissed, so the flag survives its own dismissal on screen as
    // well as in the audit trail.
    reasons: acknowledged.reasons,
    note: `Cleared the attention flag on ${acknowledged.cleared} APLIIQ fulfillment row${acknowledged.cleared === 1 ? "" : "s"}. Refresh to load the updated queue.`,
  });
}
