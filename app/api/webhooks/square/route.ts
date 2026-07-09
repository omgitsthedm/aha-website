import { NextResponse } from "next/server";
import { getFulfillmentMode, getCommerceEnvironment } from "@/lib/commerce/runtime";
import {
  normalizeSquareWebhookEnvironment,
  verifySquareWebhookSignature,
} from "@/lib/square/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  const squareEnvironment = normalizeSquareWebhookEnvironment(
    request.headers.get("square-environment")
  );
  const expectedEnvironment = getCommerceEnvironment();

  if (!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY) {
    console.error("Square webhook signature key is not configured.");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  if (!process.env.SQUARE_WEBHOOK_NOTIFICATION_URL) {
    console.error("Square webhook notification URL is not configured.");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  const verified = verifySquareWebhookSignature({
    rawBody,
    signature,
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    notificationUrl: process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,
  });

  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (squareEnvironment && squareEnvironment !== expectedEnvironment) {
    console.warn(
      `Square webhook environment mismatch: got ${squareEnvironment}, expected ${expectedEnvironment}.`
    );
    return NextResponse.json({ error: "Environment mismatch" }, { status: 409 });
  }

  let event: { event_id?: string; type?: string; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fulfillmentMode = getFulfillmentMode();
  console.info("Square webhook received", {
    eventId: event.event_id || null,
    type: event.type || null,
    fulfillmentMode,
  });

  return NextResponse.json(
    {
      received: true,
      eventId: event.event_id || null,
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
    { ok: true, provider: "square", mode: getFulfillmentMode() },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}

