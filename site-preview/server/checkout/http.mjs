import { CheckoutError } from "./errors.mjs";
import { boundedText } from '../http/body.mjs';

export async function jsonBody(request) {
  try { return JSON.parse(await boundedText(request, 16_384)); }
  catch { throw new CheckoutError("invalid_request", 400); }
}
export function noStore(body, status = 200) { return Response.json(body, { status, headers: { "cache-control": "no-store" } }); }
