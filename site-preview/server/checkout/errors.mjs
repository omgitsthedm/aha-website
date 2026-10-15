export class CheckoutError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

export function asCheckoutError(error) {
  return error instanceof CheckoutError ? error : new CheckoutError("checkout_unavailable", 503);
}

export function errorResponse(error) {
  const safe = asCheckoutError(error);
  return Response.json({ error: safe.code, errorCode: safe.code }, { status: safe.status, headers: { "cache-control": "no-store" } });
}
