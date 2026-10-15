import { CheckoutError } from "./errors.mjs";

export async function jsonBody(request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > 16_384) throw new CheckoutError("invalid_request", 400);
  const raw = await request.text();
  if (raw.length > 16_384) throw new CheckoutError("invalid_request", 400);
  try { return JSON.parse(raw); } catch { throw new CheckoutError("invalid_request", 400); }
}
export function noStore(body, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
