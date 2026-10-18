import { randomBytes, createHash, randomUUID } from "node:crypto";
import { buildSquareOrder, CURRENCY, normalizeAddress, normalizeItems } from "./catalog.mjs";
import { CheckoutError } from "./errors.mjs";
import { normalizeAnalyticsIds } from "../analytics/posthog.mjs";
import { narrowMarketingContext, normalizeMarketingContext, restrictMarketingContext } from "../analytics/marketing.mjs";

const QUOTE_TTL_MS = 15 * 60 * 1000;
const PAYMENT_OUTCOME_GRACE_MS = 90 * 1000;
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function token() { return randomBytes(32).toString("base64url"); }
function expectedIdempotency(key) { return typeof key === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(key); }
function total(order) { const amount = order?.total_money?.amount; return Number.isSafeInteger(amount) && amount >= 0 ? amount : null; }
function safeReceiptUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "squareup.com" || url.hostname.endsWith(".squareup.com")) ? url.href : undefined; } catch { return undefined; }
}
function lineResponse(items) { return items.map(({ variationId, quantity, unitAmount, totalAmount, size, product }) => ({ variationId, quantity, unitAmount, totalAmount, size, product })); }
function expiredLease(session, now) { return !session.processing_lease_expires_at || new Date(session.processing_lease_expires_at).getTime() <= now; }
function paymentOutcomeTimedOut(session, now) {
  const started = new Date(session.payment_submission_started_at ?? 0).getTime();
  return Number.isFinite(started) && started > 0 && started + PAYMENT_OUTCOME_GRACE_MS <= now;
}

export function createCheckoutService({ repository, square, config, catalog, eligibleProviders = [], now = () => Date.now(), createId = randomUUID }) {
  if (!config.locationId) throw new Error("checkout location is not configured");
  async function quote({ items: rawItems, shippingAddress, analytics: rawAnalytics, marketing: rawMarketing }) {
    const items = normalizeItems(rawItems, catalog);
    const address = normalizeAddress(shippingAddress);
    const analytics = normalizeAnalyticsIds(rawAnalytics ?? {
      distinctId: rawMarketing?.analytics?.posthogDistinctId,
      sessionId: rawMarketing?.analytics?.posthogSessionId,
    });
    const checkoutId = createId();
    const checkoutToken = token();
    const orderPayload = buildSquareOrder({ items, address, locationId: config.locationId, referenceId: `AHA-${checkoutId}` });
    let priced;
    try { priced = await square.calculateOrder(orderPayload); } catch { throw new CheckoutError("checkout_unavailable", 503); }
    const totalCents = total(priced);
    if (totalCents === null || priced.location_id !== config.locationId) throw new CheckoutError("checkout_unavailable", 503);
    const subtotalCents = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const shippingCents = address.country === "US" ? 0 : 2500;
    const taxCents = Number(priced.total_tax_money?.amount ?? 0);
    if (!Number.isSafeInteger(taxCents) || totalCents !== subtotalCents + shippingCents + taxCents) throw new CheckoutError("checkout_unavailable", 503);
    const taxLabel = taxCents ? "Arizona TPT (Peoria 8.1%)" : null;
    const expiresAt = new Date(now() + QUOTE_TTL_MS).toISOString();
    await repository.create({ checkoutId, tokenHash: sha256(checkoutToken), currency: CURRENCY, cart: items, address, orderPayload, subtotalCents, shippingCents, taxCents, totalCents, taxLabel, orderIdempotencyKey: `aha-order-${checkoutId}`, expiresAt, analytics });
    // Never reject a quote if the optional attribution migration has not been
    // applied yet. The explicit context is normalized before it is persisted.
    await repository.saveMarketing?.({ checkoutId, context: {
      ...normalizeMarketingContext(rawMarketing),
      eligibleProviders: ["google", "meta"].filter((provider) => Array.isArray(eligibleProviders) && eligibleProviders.includes(provider)),
      paymentConsentConfirmed: false,
    } });
    return { checkoutId, checkoutToken, expiresAt, currency: CURRENCY, shippingRegion: address.region, lineItems: lineResponse(items), subtotalAmount: subtotalCents, shippingAmount: shippingCents, taxAmount: taxCents, totalAmount: totalCents, taxLabel, shippingLabel: shippingCents ? "International shipping" : "Free U.S. shipping" };
  }
  async function persistNarrowedMarketing(session, derive, { required = false } = {}) {
    let current = session;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const expected = current?.marketing_json ?? {};
      const context = derive(expected);
      try {
        const saved = repository.compareAndSetMarketing
          ? await repository.compareAndSetMarketing({ checkoutId: current.checkout_id, expected, context })
          : await repository.saveMarketing?.({ checkoutId: current.checkout_id, context });
        if (saved) return saved;
      } catch {
        if (!required) return null;
        throw new CheckoutError("privacy_unavailable", 503);
      }
      try { current = await repository.get(current?.checkout_id); } catch {
        if (required) throw new CheckoutError("privacy_unavailable", 503);
        return null;
      }
      if (!current) break;
    }
    if (required) throw new CheckoutError("privacy_unavailable", 503);
    return null;
  }
  function authorize(session, checkoutToken, { requireFreshQuote = false } = {}) {
    if (!session || !checkoutToken || sha256(checkoutToken) !== session.token_sha256) throw new CheckoutError("checkout_not_found", 404);
    if (requireFreshQuote && new Date(session.expires_at).getTime() <= now()) throw new CheckoutError("quote_expired", 409);
    return session;
  }
  async function status({ checkoutId, checkoutToken }) {
    if (typeof checkoutId !== "string" || checkoutId.length > 80 || typeof checkoutToken !== "string") throw new CheckoutError("invalid_request", 400);
    let session = authorize(await repository.get(checkoutId), checkoutToken);
    // A client only reaches status while recovering a submitted payment attempt.  If
    // that request was lost before it claimed the session, terminally close this
    // quote first.  A late copy of the original /pay can then never create a charge
    // after the client has been told to start a new checkout.
    if (session.state === "quoted") {
      session = await repository.cancelUnclaimedRecovery({ checkoutId, tokenHash: sha256(checkoutToken) })
        ?? authorize(await repository.get(checkoutId), checkoutToken);
    }
    if ((session.state === "processing" || session.state === "unknown") && expiredLease(session, now()) && !session.payment_submission_started_at) {
      session = await repository.closeExpiredUnpaid({ checkoutId, tokenHash: sha256(checkoutToken) })
        ?? authorize(await repository.get(checkoutId), checkoutToken);
    }
    if ((session.state === "unknown" || session.state === "processing") && session.square_order_id) {
      try {
        const order = await square.getOrder(session.square_order_id);
        const tender = order?.tenders?.find((item) => item?.payment_id || item?.id);
        const paymentId = tender?.payment_id ?? tender?.id;
        if (paymentId) {
          const payment = await square.getPayment(paymentId);
          if (payment?.status === "COMPLETED" && payment.order_id === session.square_order_id && payment.location_id === config.locationId && payment.amount_money?.amount === session.total_cents && payment.amount_money?.currency === CURRENCY) session = await repository.complete({ checkoutId, orderId: session.square_order_id, paymentId: payment.id, receiptUrl: safeReceiptUrl(payment.receipt_url) ?? null });
        }
      } catch { /* Preserve state: never replay a potentially charged source token. */ }
    }
    if ((session.state === "unknown" || session.state === "processing") && session.payment_submission_started_at && paymentOutcomeTimedOut(session, now())) {
      session = await repository.attention({ checkoutId, code: "payment_outcome_unknown" }) ?? session;
    }
    const publicState = session.state === "unknown" && session.payment_submission_started_at ? (paymentOutcomeTimedOut(session, now()) ? "attention" : "pending") : session.state;
    return { state: publicState, checkoutId: session.checkout_id, orderId: session.square_order_id ?? undefined, paymentId: session.square_payment_id ?? undefined, receiptUrl: safeReceiptUrl(session.square_receipt_url), error: session.last_error_code ?? undefined };
  }
  async function pay({ checkoutId, checkoutToken, sourceId, idempotencyKey, marketing: rawMarketing }) {
    if (typeof checkoutId !== "string" || checkoutId.length > 80 || typeof checkoutToken !== "string" || typeof sourceId !== "string" || sourceId.length < 8 || sourceId.length > 512 || !expectedIdempotency(idempotencyKey)) throw new CheckoutError("invalid_request", 400);
    let existing = authorize(await repository.get(checkoutId), checkoutToken);
    // A visitor may opt out between the quote and the payment screen. Persist
    // only the intersection before the payment call; this optional write can
    // never interrupt a real charge if the additive migration is still absent.
    const restricted = await persistNarrowedMarketing(existing, (stored) => restrictMarketingContext(stored, rawMarketing));
    // This cannot interrupt a payment, but a response that could not persist
    // its narrowed consent must not trigger after-response tracking.
    const trackingSuppressed = !restricted;
    const trackingResult = trackingSuppressed ? { trackingSuppressed: true } : {};
    if (restricted) existing = restricted;
    if (existing.state === "completed") return { state: "completed", checkoutId, orderId: existing.square_order_id, paymentId: existing.square_payment_id, receiptUrl: safeReceiptUrl(existing.square_receipt_url), ...trackingResult };
    if (existing.state === "unknown" || existing.state === "processing") return { state: "pending", checkoutId };
    if (new Date(existing.expires_at).getTime() <= now()) throw new CheckoutError("quote_expired", 409);
    const session = await repository.claim({ checkoutId, tokenHash: sha256(checkoutToken), clientIdempotencyKey: idempotencyKey });
    if (!session) {
      const current = authorize(await repository.get(checkoutId), checkoutToken);
      if (current.state === "completed") return { state: "completed", checkoutId, orderId: current.square_order_id, paymentId: current.square_payment_id, receiptUrl: safeReceiptUrl(current.square_receipt_url), ...trackingResult };
      if (current.state === "processing" || current.state === "unknown") return { state: "pending", checkoutId };
      throw new CheckoutError(current.last_error_code === "payment_failed" ? "payment_failed" : "quote_stale", current.last_error_code === "payment_failed" ? 402 : 409);
    }
    let orderId = session.square_order_id;
    try {
      if (!orderId) {
        const order = await square.createOrder(session.order_payload_json, session.order_idempotency_key);
        if (!order?.id || order.location_id !== config.locationId || total(order) !== session.total_cents) throw new Error("square_order_mismatch");
        orderId = order.id;
        const saved = await repository.saveOrder({ checkoutId, orderId });
        if (!saved) return { state: "pending", checkoutId };
      }
      const marked = await repository.markPaymentSubmissionStarted({ checkoutId, orderId });
      if (!marked) return { state: "pending", checkoutId };
      const payment = await square.createPayment({ source_id: sourceId, idempotency_key: `aha-pay-${checkoutId}`, amount_money: { amount: session.total_cents, currency: CURRENCY }, order_id: orderId, location_id: config.locationId, buyer_email_address: session.shipping_address_json.email, autocomplete: true, reference_id: `AHA-${checkoutId}` });
      if (payment?.status !== "COMPLETED" || payment.order_id !== orderId || payment.location_id !== config.locationId || payment.amount_money?.amount !== session.total_cents || payment.amount_money?.currency !== CURRENCY) throw new Error("square_payment_mismatch");
      const receiptUrl = safeReceiptUrl(payment.receipt_url);
      await repository.complete({ checkoutId, orderId, paymentId: payment.id, receiptUrl: receiptUrl ?? null });
      return { state: "completed", checkoutId, orderId, paymentId: payment.id, receiptUrl, ...trackingResult };
    } catch (error) {
      if (!orderId) { await repository.releaseClaim({ checkoutId, code: "order_unavailable" }); throw new CheckoutError("checkout_unavailable", 503); }
      if (error?.status >= 400 && error?.status < 500) { await repository.fail({ checkoutId, code: "payment_failed" }); throw new CheckoutError("payment_failed", 402); }
      await repository.unknown({ checkoutId, code: "payment_outcome_unknown", orderId });
      return { state: "pending", checkoutId };
    }
  }
  async function privacy({ checkouts, analytics, marketing, gpc }) {
    if (!Array.isArray(checkouts) || checkouts.length < 1 || checkouts.length > 10 || ![analytics, marketing, gpc].every((value) => typeof value === "boolean")) throw new CheckoutError("invalid_request", 400);
    const unique = new Map();
    for (const receipt of checkouts) {
      if (typeof receipt?.checkoutId !== "string" || receipt.checkoutId.length > 80 || typeof receipt?.checkoutToken !== "string" || receipt.checkoutToken.length < 32 || receipt.checkoutToken.length > 128) throw new CheckoutError("invalid_request", 400);
      if (unique.has(receipt.checkoutId)) throw new CheckoutError("invalid_request", 400);
      try { unique.set(receipt.checkoutId, authorize(await repository.get(receipt.checkoutId), receipt.checkoutToken)); } catch (error) {
        if (!(error instanceof CheckoutError && error.code === "checkout_not_found")) throw error;
        // A stale receipt cannot block a valid withdrawal.
      }
    }
    let updated = 0;
    for (const [checkoutId, session] of unique) {
      const saved = await persistNarrowedMarketing(session, (stored) => narrowMarketingContext(stored, { analytics, marketing, gpc }), { required: true });
      const context = saved.marketing_json;
      // Retry the cancellation even when the previous privacy write already
      // succeeded but its outbox update was interrupted.
      const disallowed = [
        ...(!context.analytics?.consent ? ["google"] : []),
        ...(!context.marketing?.consent || context.marketing?.gpc ? ["meta"] : []),
      ];
      if (disallowed.length) await repository.disableOutstandingMarketing?.({ checkoutId, providers: disallowed });
      updated += 1;
    }
    return { accepted: true, updated };
  }
  return { quote, pay, status, privacy };
}

export function publicCheckoutResult(result) {
  const { trackingSuppressed: _trackingSuppressed, ...publicResult } = result;
  return publicResult;
}
