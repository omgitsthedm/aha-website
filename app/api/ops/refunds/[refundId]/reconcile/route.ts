// Ops-only: book the APLIIQ recovery leg onto a refund that is already recorded.
//
// The refund itself is already settled and the shopper already has their money;
// this route only answers "and how much of what we paid APLIIQ came back?".
//
// It exists because refund_audit_log was INSERT-only. A leg booked as NULL/NULL
// — the refund settled before the operator held the APLIIQ receipt, or the
// pending note in app/api/ops/orders/[id]/refund/route.ts failed to save — had
// no way back. The advice to "re-enter it once it settles" pointed at a
// capability that did not exist, so the money APLIIQ returned was written off
// in silence. This is that capability.
//
// Guarded by the ops session cookie and 404s like every other ops route, so an
// unauthenticated caller cannot even learn the endpoint exists.
//
// POST /api/ops/refunds/<squareRefundId>/reconcile
//   {
//     "recoveryTier": "post_garment",         // required
//     "outcome": "refunded",                  // voided | refunded | not_attempted
//     "productCents": 2225, "shippingCents": 596,   // model the tier, or…
//     "recoveredAmountCents": 1041,           // …the receipt, which wins
//     "note": "APLIIQ credit memo 88213",
//     "allowOverwrite": false                 // required to change a booked figure
//   }
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PROVIDER_RECOVERY_TIER, type ProviderRecoveryTier } from "@/db/schema";
import { isDbConfigured } from "@/lib/db/client";
import { OPS_COOKIE, verifyOpsSessionToken } from "@/lib/ops/auth";
import {
  calculateProviderRecoveryCents,
  reconcileRefundProviderLeg,
} from "@/lib/commerce/webhooks";

export const dynamic = "force-dynamic";

/** Same vocabulary as the refund route, so one operator learns one set of words. */
const PROVIDER_OUTCOMES = ["voided", "refunded", "not_attempted"] as const;
type ProviderOutcome = (typeof PROVIDER_OUTCOMES)[number];

interface ReconcileRequestBody {
  recoveryTier?: string;
  outcome?: string;
  /** What we paid APLIIQ for the goods, incl. the $1/product fulfillment fee. */
  productCents?: number;
  /** What APLIIQ billed for freight, which is charged separately. */
  shippingCents?: number;
  /** Overrides the modelled tier math when the provider receipt is in hand. */
  recoveredAmountCents?: number;
  note?: string;
  allowOverwrite?: boolean;
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function POST(request: Request, { params }: { params: Promise<{ refundId: string }> }) {
  if (!verifyOpsSessionToken((await cookies()).get(OPS_COOKIE)?.value)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const squareRefundId = String((await params).refundId ?? "").trim();
  if (!squareRefundId) return badRequest("Invalid refund id.");
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Production order store is unavailable." }, { status: 503 });
  }

  let body: ReconcileRequestBody;
  try {
    body = (await request.json()) as ReconcileRequestBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!(PROVIDER_RECOVERY_TIER as readonly string[]).includes(String(body?.recoveryTier))) {
    return badRequest(`recoveryTier must be one of ${PROVIDER_RECOVERY_TIER.join(", ")}.`);
  }
  const recoveryTier = body.recoveryTier as ProviderRecoveryTier;

  let outcome: ProviderOutcome = "refunded";
  if (body.outcome !== undefined) {
    if (!(PROVIDER_OUTCOMES as readonly string[]).includes(body.outcome)) {
      return badRequest(`outcome must be one of ${PROVIDER_OUTCOMES.join(", ")}.`);
    }
    outcome = body.outcome as ProviderOutcome;
  }
  for (const field of ["productCents", "shippingCents", "recoveredAmountCents"] as const) {
    if (body[field] !== undefined && !isNonNegativeInteger(body[field])) {
      return badRequest(`${field} must be a non-negative whole number of cents.`);
    }
  }

  // Same rule as the refund route: modelling an amount we cannot compute would
  // be indistinguishable from "recovered nothing", which is a real outcome.
  let recoveredAmountCents: number;
  if (body.recoveredAmountCents !== undefined) {
    // The receipt beats the model.
    recoveredAmountCents = body.recoveredAmountCents;
  } else if (outcome === "not_attempted") {
    return badRequest(
      "recoveredAmountCents is required to close a leg the provider cancellation never attempted — the tier ladder cannot model money nobody asked for.",
    );
  } else if (body.productCents === undefined && body.shippingCents === undefined) {
    return badRequest(
      "productCents/shippingCents (or recoveredAmountCents) are required to reconcile the provider leg.",
    );
  } else {
    recoveredAmountCents = calculateProviderRecoveryCents({
      tier: recoveryTier,
      providerProductCents: body.productCents ?? 0,
      providerShippingCents: body.shippingCents ?? 0,
    });
  }

  const note = String(body.note ?? "").trim();
  const allowOverwrite = body.allowOverwrite === true;
  // Replacing a figure that is already booked is a correction to the books, so
  // it does not happen without someone writing down why.
  if (allowOverwrite && !note) {
    return badRequest("A note is required to overwrite a provider recovery leg that is already reconciled.");
  }

  const result = await reconcileRefundProviderLeg({
    squareRefundId,
    providerRecoveryTier: recoveryTier,
    recoveredAmountCents,
    actor: "ops",
    providerOutcome: outcome,
    note: note || null,
    allowOverwrite,
  });

  if (result.applied) {
    return NextResponse.json({
      ok: true,
      applied: true,
      squareRefundId,
      orderId: result.orderId,
      // Echoed from the row Postgres returned, not from what was asked for.
      providerRecoveryTier: result.stored.providerRecoveryTier,
      recoveredAmountCents: result.stored.recoveredAmountCents,
      previous: result.previous,
      providerOutcome: outcome,
      audited: result.audited,
      ...(result.audited
        ? {}
        : {
            note: "The ledger row was reconciled but its audit_log entry failed to write. The money is correct; the trail is not.",
          }),
    });
  }

  switch (result.reason) {
    case "unchanged":
      // A retried POST. The books already say exactly this, so it is a success.
      return NextResponse.json({
        ok: true,
        applied: false,
        reason: "unchanged",
        squareRefundId,
        orderId: result.orderId,
        providerRecoveryTier: result.current?.providerRecoveryTier ?? null,
        recoveredAmountCents: result.current?.recoveredAmountCents ?? null,
      });
    case "already_reconciled":
      return NextResponse.json({
        ok: false,
        applied: false,
        reason: "already_reconciled",
        error:
          "This refund's provider leg is already reconciled to a different figure. Re-send with allowOverwrite:true and a note to correct it.",
        squareRefundId,
        orderId: result.orderId,
        current: result.current,
      }, { status: 409 });
    case "raced":
      return NextResponse.json({
        ok: false,
        applied: false,
        reason: "raced",
        error: "Another reconciliation changed this refund while this one was in flight. Re-read the row and try again.",
        squareRefundId,
        orderId: result.orderId,
      }, { status: 409 });
    case "refund_not_found":
      return NextResponse.json({
        ok: false,
        applied: false,
        reason: "refund_not_found",
        error:
          "No recorded refund with that Square refund id. A refund Square has not settled yet is not in the ledger — wait for the refund webhook to book it.",
        squareRefundId,
      }, { status: 404 });
    case "db_unavailable":
      return NextResponse.json({ ok: false, error: "Production order store is unavailable." }, { status: 503 });
    default:
      return NextResponse.json({ ok: false, reason: result.reason, error: "Reconciliation rejected." }, { status: 400 });
  }
}
