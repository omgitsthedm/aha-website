export class CheckoutError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

// Keep only allow-listed diagnostics, never the processor payload or card data.
// A transport error or an unfamiliar response remains an unresolved payment.
export function paymentFailure(error) {
  if (!(error?.status >= 400 && error.status < 500)) return null;
  const codes = new Set((error.details?.errors ?? []).map((entry) => entry?.code));
  const groups = [
    ["payment_cvv_failed", ["CVV_FAILURE"]],
    ["payment_address_failed", ["ADDRESS_VERIFICATION_FAILURE"]],
    ["payment_card_expired", ["CARD_EXPIRED", "EXPIRATION_FAILURE", "INVALID_EXPIRATION"]],
    ["payment_token_expired", ["CARD_TOKEN_EXPIRED", "CARD_TOKEN_USED"]],
    ["payment_failed", ["GENERIC_DECLINE", "CARD_DECLINED", "INSUFFICIENT_FUNDS", "PAN_FAILURE", "INVALID_CARD", "INVALID_ACCOUNT"]],
  ];
  // Never offer another charge if Square reports a nonterminal or successful payment.
  if (error.details?.payment && !["FAILED", "CANCELED"].includes(error.details.payment.status)) return null;
  if ([401, 403, 429].includes(error.status)) return { code: "payment_service_unavailable", status: 503 };
  for (const [code, upstream] of groups) if (upstream.some((value) => codes.has(value))) return { code, status: 402 };
  return null;
}

export function asCheckoutError(error) {
  return error instanceof CheckoutError ? error : new CheckoutError("checkout_unavailable", 503);
}

export function errorResponse(error) {
  const safe = asCheckoutError(error);
  return Response.json({ error: safe.code, errorCode: safe.code }, { status: safe.status, headers: { "cache-control": "no-store" } });
}
