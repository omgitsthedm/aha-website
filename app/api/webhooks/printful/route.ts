import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getFulfillmentMode } from "@/lib/commerce/runtime";
import { verifyPrintfulWebhookSignature } from "@/lib/printful/webhooks";
import { reportCheckoutError } from "@/lib/commerce/checkout-alert";
import {
  recordWebhookEvent, applyPrintfulEvent, markWebhookProcessed, markWebhookFailed,
} from "@/lib/commerce/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-pf-webhook-signature");
  const publicKey = request.headers.get("x-pf-webhook-public-key");
  const expectedPublicKey = process.env.PRINTFUL_WEBHOOK_PUBLIC_KEY;

  if (!process.env.PRINTFUL_WEBHOOK_SECRET_KEY) {
    console.error("Printful webhook secret key is not configured.");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  if (expectedPublicKey && publicKey !== expectedPublicKey) {
    return NextResponse.json({ error: "Invalid public key" }, { status: 401 });
  }

  const verified = verifyPrintfulWebhookSignature({
    rawBody,
    signature,
    secretKeyHex: process.env.PRINTFUL_WEBHOOK_SECRET_KEY,
  });

  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; occurred_at?: string; store_id?: number; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fulfillmentMode = getFulfillmentMode();

  // Printful events carry no unique id — dedupe on a hash of the raw body.
  const dedupeKey = createHash("sha256").update(rawBody).digest("hex");
  let eventRecordId: number | null = null;
  try {
    const recorded = await recordWebhookEvent({
      provider: "printful", eventId: null, eventType: event.type,
      signatureValid: true, rawPayload: event, dedupeKey,
    });
    eventRecordId = recorded.eventRecordId;
    if (recorded.isNew) {
      await applyPrintfulEvent(event);
      await markWebhookProcessed(eventRecordId);
    }
  } catch (err) {
    await markWebhookFailed(eventRecordId, err).catch(() => {});
    console.error("Printful webhook processing failed:", err);
    void reportCheckoutError({ route: "webhooks/printful", stage: "process", err });
  }

  return NextResponse.json(
    {
      received: true,
      type: event.type || null,
      fulfillmentMode,
      action:
        fulfillmentMode === "dry-run"
          ? "validated-and-held-for-dry-run"
          : "validated-and-held-for-manual-review",
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export function GET() {
  return NextResponse.json(
    { ok: true, provider: "printful", mode: getFulfillmentMode() },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
