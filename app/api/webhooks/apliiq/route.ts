import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getFulfillmentMode } from "@/lib/commerce/runtime";
import { reportCheckoutError } from "@/lib/commerce/checkout-alert";
import { verifyApliiqFulfillmentWebhookSignature } from "@/lib/apliiq/webhooks";
import {
  applyApliiqFulfillmentEvent,
  parseApliiqFulfillmentEvent,
} from "@/lib/commerce/apliiq-webhook-events";
import {
  claimWebhookEvent,
  markWebhookFailed,
  markWebhookProcessed,
  recordWebhookEvent,
} from "@/lib/commerce/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Read the exact raw bytes-as-text before parsing. The provider signs the
  // Base64 form of this body, so a JSON round trip would invalidate it.
  const rawBody = await request.text();
  // APLIIQ documents the fulfillment HMAC as using the same Shared_SECRET as
  // API authentication. Do not introduce a second, unverifiable secret.
  const sharedSecret = process.env.APLIIQ_SHARED_SECRET;
  if (!sharedSecret) {
    console.error("APLIIQ fulfillment webhook secret is not configured.");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  const verified = verifyApliiqFulfillmentWebhookSignature({
    rawBody,
    signature: request.headers.get("x-apliiq-hmac"),
    sharedSecret,
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseApliiqFulfillmentEvent(rawPayload);
  if (!event) {
    return NextResponse.json({ error: "Invalid fulfillment event" }, { status: 400 });
  }

  // APLIIQ's callback documentation does not provide a durable event id.
  // Hashing the verified raw body gives deterministic cross-retry dedupe.
  const dedupeKey = createHash("sha256").update(rawBody).digest("hex");
  let eventRecordId: number | null = null;
  try {
    const recorded = await recordWebhookEvent({
      provider: "apliiq",
      eventId: null,
      eventType: "fulfillment",
      signatureValid: true,
      rawPayload,
      dedupeKey,
    });
    eventRecordId = recorded.eventRecordId;
    if (!eventRecordId) throw new Error("Webhook event store is unavailable");
    const shouldProcess = await claimWebhookEvent(eventRecordId);
    let outcome = "duplicate";
    if (shouldProcess) {
      const applied = await applyApliiqFulfillmentEvent(event);
      if (applied.outcome === "unmatched" || applied.outcome === "ambiguous") {
        throw new Error(`APLIIQ fulfillment event is ${applied.outcome}`);
      }
      await markWebhookProcessed(eventRecordId);
      outcome = applied.outcome;
    } else if (recorded.processingStatus !== "processed") {
      // An invocation with a live lease may still be applying this event. A
      // retryable response prevents the provider from treating that race as
      // permanent success; a later redelivery can reclaim a stale lease.
      return NextResponse.json(
        { error: "Webhook event is already processing" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const fulfillmentMode = getFulfillmentMode();
    return NextResponse.json({
      received: true,
      provider: "apliiq",
      outcome,
      fulfillmentMode,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    await markWebhookFailed(eventRecordId, err).catch(() => {});
    console.error("APLIIQ webhook processing failed:", err);
    void reportCheckoutError({ route: "webhooks/apliiq", stage: "process", err });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: true, provider: "apliiq", mode: getFulfillmentMode() },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
