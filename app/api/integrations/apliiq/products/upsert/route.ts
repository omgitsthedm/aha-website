import { NextResponse } from "next/server";
import {
  ApliiqProductCallbackUnavailableError,
  ApliiqProductCallbackValidationError,
  isApliiqProductCallbackConfigured,
  isAuthorizedApliiqProductCallback,
  parseApliiqAddToStorePayload,
  upsertApliiqProductDraft,
} from "@/lib/apliiq/product-callbacks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

function failed(message: string, status: number): NextResponse {
  // This matches APLIIQ's documented Add to Store response envelope without
  // claiming that any storefront product was created or activated.
  return response({ storeProductId: null, stepsCompleted: [], hasError: true, errorMessages: [message] }, status);
}

export async function POST(request: Request) {
  if (!isApliiqProductCallbackConfigured()) return failed("Product callback is not configured.", 503);
  if (!isAuthorizedApliiqProductCallback(request)) return failed("Unauthorized product callback.", 401);

  let rawPayload: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 512 * 1024) {
      return failed("Product callback payload is too large.", 413);
    }
    rawPayload = JSON.parse(rawBody);
  } catch {
    return failed("Invalid JSON payload.", 400);
  }

  try {
    const payload = parseApliiqAddToStorePayload(rawPayload);
    const storeProductId = await upsertApliiqProductDraft(payload);
    return response({
      storeProductId,
      stepsCompleted: ["DraftCreated"],
      hasError: false,
      errorMessages: [],
    });
  } catch (error) {
    if (error instanceof ApliiqProductCallbackValidationError) return failed(error.message, 400);
    if (error instanceof ApliiqProductCallbackUnavailableError) return failed(error.message, 503);
    return failed("Product callback could not be processed.", 503);
  }
}
