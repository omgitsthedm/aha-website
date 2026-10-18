// Purchase delivery for Google and Meta.  This module deliberately keeps the
// event payload to product, amount and anonymous browser identifiers.  Payment
// and fulfillment always finish independently of this optional delivery.
import { CLIENT, SITE_ORIGIN } from "../platform/client.mjs";

const ID = /^[A-Za-z0-9_.:-]{1,160}$/;
const META_ID = /^\d{5,24}$/;
const PATH = /^\/[A-Za-z0-9/_~.-]{0,240}$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"];
const EVENT_SOURCE_URL = `${SITE_ORIGIN}/checkout/`;

function clean(value, max = 160) {
  return typeof value === "string" && value.length > 0 && value.length <= max && ID.test(value) ? value : null;
}

function cleanUtm(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9 ._~:-]+$/.test(value) ? value : null;
}

function cleanPath(value) { return typeof value === "string" && PATH.test(value) ? value : null; }
function cleanUserAgent(value) { return typeof value === "string" && value.length > 0 && value.length <= 500 && /^[\x20-\x7e]+$/.test(value) ? value : null; }

/**
 * Accept the public checkout envelope, then retain only bounded anonymous
 * values. Missing or revoked consent means no server marketing delivery.
 */
export function normalizeMarketingContext(value) {
  const analytics = value?.analytics;
  const marketing = value?.marketing;
  const analyticsGranted = analytics?.consent === true;
  const gpc = marketing?.gpc === true;
  const marketingGranted = marketing?.consent === true && !gpc;
  const attribution = marketing?.attribution ?? {};
  const utm = Object.fromEntries(UTM_KEYS.flatMap((key) => {
    const item = cleanUtm(attribution?.utm?.[key]);
    return item ? [[key, item]] : [];
  }));
  const clicks = Object.fromEntries(CLICK_KEYS.flatMap((key) => {
    const item = clean(attribution?.[key], 200);
    return item ? [[key, item]] : [];
  }));
  const fbp = clean(marketing?.meta?.fbp, 200);
  const fbc = clean(marketing?.meta?.fbc, 200);
  const safeAttribution = {
    ...(Object.keys(utm).length ? { utm } : {}),
    ...clicks,
    ...(cleanPath(attribution?.landingPath) ? { landingPath: cleanPath(attribution.landingPath) } : {}),
  };
  return {
    analytics: {
      consent: analyticsGranted,
      gaClientId: analyticsGranted ? clean(analytics?.gaClientId) : null,
      gaSessionId: analyticsGranted ? clean(analytics?.gaSessionId) : null,
    },
    marketing: {
      consent: marketingGranted,
      gpc,
      attribution: marketingGranted ? safeAttribution : {},
      meta: marketingGranted ? { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) } : {},
      userAgent: marketingGranted ? cleanUserAgent(marketing?.userAgent) : null,
    },
  };
}

function storedProviders(value) {
  return ["google", "meta"].filter((provider) => Array.isArray(value?.eligibleProviders) && value.eligibleProviders.includes(provider));
}

export function eligibleProviders(env) {
  const config = deliveryConfig(env);
  return [
    ...( /^G-[A-Z0-9]+$/.test(config.google.measurementId ?? "") && config.google.apiSecret ? ["google"] : []),
    ...(META_ID.test(config.meta.datasetId ?? "") && config.meta.accessToken ? ["meta"] : []),
  ];
}

// A consent update at payment time can only narrow a quote's stored state. It
// cannot turn tracking on later or restore identifiers after an opt-out.
export function restrictMarketingContext(stored, paymentTime) {
  const before = normalizeMarketingContext(stored);
  const current = normalizeMarketingContext(paymentTime);
  const analytics = before.analytics.consent && current.analytics.consent;
  const marketing = before.marketing.consent && current.marketing.consent && !before.marketing.gpc && !current.marketing.gpc;
  return {
    paymentConsentConfirmed: true,
    // This is server-owned and frozen at quote creation. It prevents a later
    // credential change from replaying an old completed checkout.
    eligibleProviders: storedProviders(stored),
    analytics: {
      consent: analytics,
      gaClientId: analytics ? before.analytics.gaClientId : null,
      gaSessionId: analytics ? before.analytics.gaSessionId : null,
    },
    marketing: {
      consent: marketing,
      gpc: before.marketing.gpc || current.marketing.gpc,
      attribution: marketing ? before.marketing.attribution : {},
      meta: marketing ? before.marketing.meta : {},
      userAgent: marketing ? before.marketing.userAgent : null,
    },
  };
}

function lines(session) {
  return Array.isArray(session?.cart_json) ? session.cart_json
    .filter((line) => typeof line?.variationId === "string" && Number.isInteger(line?.quantity) && line.quantity > 0 && Number.isSafeInteger(line?.unitAmount) && line.unitAmount >= 0)
    .map((line) => ({ id: line.variationId, quantity: line.quantity, unitAmount: line.unitAmount, price: line.unitAmount / 100 })) : [];
}

export function purchasePayload(session, eventTimeMs = Date.now()) {
  const items = lines(session);
  if (!session?.square_order_id || !items.length || session.currency !== "USD" || !Number.isSafeInteger(session.total_cents) || session.total_cents < 0 || !Number.isSafeInteger(eventTimeMs) || eventTimeMs < 0) return null;
  // Quotes are deliberately unconfirmed. Only a successful payment-time
  // consent write permits server delivery; a missing migration fails closed.
  if (session?.marketing_json?.paymentConsentConfirmed !== true) return null;
  const context = normalizeMarketingContext(session.marketing_json);
  const merchandiseCents = items.reduce((sum, item) => sum + (item.unitAmount * item.quantity), 0);
  const shippingCents = Number.isSafeInteger(session.shipping_cents) && session.shipping_cents >= 0 ? session.shipping_cents : 0;
  const taxCents = Number.isSafeInteger(session.tax_cents) && session.tax_cents >= 0 ? session.tax_cents : 0;
  return {
    orderId: session.square_order_id,
    currency: "USD",
    value: session.total_cents / 100,
    merchandiseValue: merchandiseCents / 100,
    shipping: shippingCents / 100,
    tax: taxCents / 100,
    eligibleProviders: storedProviders(session.marketing_json),
    items,
    context,
    eventTimeMs,
  };
}

function eventItems(items) {
  return items.map((item) => ({ item_id: item.id, price: item.price, quantity: item.quantity }));
}

export function googlePurchaseRequest(payload) {
  const { context } = payload;
  if (!context.analytics.consent || !context.analytics.gaClientId) return null;
  return {
    client_id: context.analytics.gaClientId,
    timestamp_micros: payload.eventTimeMs * 1000,
    events: [{
      name: "purchase",
      params: {
        transaction_id: payload.orderId,
        currency: payload.currency,
        // GA4's purchase value is the sum of item price × quantity. Tax and
        // shipping are reported separately and are not part of that value.
        value: payload.merchandiseValue,
        shipping: payload.shipping,
        tax: payload.tax,
        items: eventItems(payload.items),
        ...(context.analytics.gaSessionId ? { session_id: context.analytics.gaSessionId, engagement_time_msec: 1 } : {}),
      },
    }],
  };
}

export function metaPurchaseRequest(payload) {
  const { context } = payload;
  if (!context.marketing.consent || context.marketing.gpc || !context.marketing.userAgent || (!context.marketing.meta.fbp && !context.marketing.meta.fbc)) return null;
  return {
    data: [{
      event_name: "Purchase",
      event_time: Math.floor(payload.eventTimeMs / 1000),
      event_id: payload.orderId,
      action_source: "website",
      event_source_url: EVENT_SOURCE_URL,
      custom_data: {
        currency: payload.currency,
        value: payload.merchandiseValue,
        content_ids: payload.items.map((item) => item.id),
        content_type: "product",
        num_items: payload.items.reduce((sum, item) => sum + item.quantity, 0),
      },
      user_data: { ...context.marketing.meta, client_user_agent: context.marketing.userAgent },
    }],
  };
}

function safeCode(error, provider) {
  if (typeof error?.code === "string" && /^[a-z0-9_]{3,80}$/.test(error.code)) return error.code;
  if (Number.isInteger(error?.status)) return `${provider}_http_${error.status}`;
  return `${provider}_delivery_failed`;
}

function endpoint(url) {
  try { const parsed = new URL(url); return parsed.protocol === "https:" ? parsed.href : null; } catch { return null; }
}

export function createGoogleDelivery({ measurementId, apiSecret, fetchImpl = fetch, timeoutMs = 1500 }) {
  if (!/^G-[A-Z0-9]+$/.test(measurementId ?? "") || !apiSecret) return { configured: false, send: async () => false };
  const url = endpoint(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`);
  return {
    configured: Boolean(url),
    async send(payload) {
      const body = googlePurchaseRequest(payload);
      if (!url || !body) return false;
      try {
        const response = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) { const error = new Error("google_delivery_failed"); error.status = response.status; throw error; }
        return true;
      } catch (error) { error.code = safeCode(error, "google"); throw error; }
    },
  };
}

export function createMetaDelivery({ datasetId, accessToken, fetchImpl = fetch, timeoutMs = 1500 }) {
  if (!META_ID.test(datasetId ?? "") || !accessToken) return { configured: false, send: async () => false };
  // v26.0 is the version exported by Meta's current official Node business SDK.
  const url = endpoint(`https://graph.facebook.com/v26.0/${datasetId}/events?access_token=${encodeURIComponent(accessToken)}`);
  return {
    configured: Boolean(url),
    async send(payload) {
      const body = metaPurchaseRequest(payload);
      if (!url || !body) return false;
      try {
        const response = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) { const error = new Error("meta_delivery_failed"); error.status = response.status; throw error; }
        const accepted = await response.json().catch(() => null);
        if (accepted?.events_received !== 1) {
          const error = new Error("meta_not_accepted"); error.code = "meta_not_accepted"; throw error;
        }
        return true;
      } catch (error) { error.code = safeCode(error, "meta"); throw error; }
    },
  };
}

export function deliveryConfig(env) {
  return {
    google: { measurementId: CLIENT.analytics.ga4, apiSecret: env.get("AHA_GA_MEASUREMENT_PROTOCOL_SECRET") },
    meta: { datasetId: CLIENT.analytics.metaPixel, accessToken: env.get("AHA_META_CAPI_ACCESS_TOKEN") },
  };
}

function verifiedCompletionTime(session, fallback) {
  const value = Date.parse(session?.updated_at ?? "");
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export function createMarketingService({ repository, deliveries, now = () => Date.now() }) {
  const backoffMinutes = (attempt) => Math.min(60, 2 ** Math.max(0, attempt - 1));
  async function enqueue(session) {
    // `updated_at` is written when the verified Square payment is marked
    // completed. Freeze that time into the outbox so a delayed retry is never
    // represented as a new purchase.
    const payload = purchasePayload(session, verifiedCompletionTime(session, now()));
    if (!payload || session?.state !== "completed") return { queued: 0 };
    const candidates = [
      ["google", deliveries.google, googlePurchaseRequest(payload)],
      ["meta", deliveries.meta, metaPurchaseRequest(payload)],
    ];
    let queued = 0;
    for (const [provider, delivery, request] of candidates) {
      if (!payload.eligibleProviders.includes(provider) || !delivery?.configured || !request) continue;
      await repository.enqueue({ provider, squareOrderId: payload.orderId, checkoutId: session.checkout_id, payload });
      queued += 1;
    }
    return { queued };
  }
  async function dispatch(limit = 8) {
    let sent = 0; let deferred = 0;
    const rows = await repository.claim(limit);
    for (const row of rows) {
      const delivery = deliveries[row.provider];
      const current = await repository.getCompletedCheckout(row.checkout_id);
      // Send the frozen payload only while the latest completed checkout still
      // grants this provider. A later opt-out disables the leased row.
      const currentPayload = purchasePayload(current, row.payload_json?.eventTimeMs);
      const allowed = currentPayload?.eligibleProviders?.includes(row.provider)
        && (row.provider === "google" ? googlePurchaseRequest(currentPayload) : metaPurchaseRequest(currentPayload));
      if (!delivery?.configured) { await repository.disable({ id: row.id, attemptCount: row.attempt_count, code: `${row.provider}_not_configured` }); continue; }
      if (!allowed) { await repository.disable({ id: row.id, attemptCount: row.attempt_count, code: `${row.provider}_permission_revoked` }); continue; }
      try {
        const result = await delivery.send(row.payload_json);
        if (result) { if (await repository.markSent({ id: row.id, attemptCount: row.attempt_count })) sent += 1; }
        else { await repository.disable({ id: row.id, attemptCount: row.attempt_count, code: `${row.provider}_not_permitted` }); }
      } catch (error) {
        await repository.retryOrAttention({ id: row.id, attemptCount: row.attempt_count, code: typeof error?.code === "string" ? error.code : `${row.provider}_delivery_failed`, retryAfterMinutes: backoffMinutes(row.attempt_count) });
        deferred += 1;
      }
    }
    return { attempted: rows.length, sent, deferred };
  }
  return { enqueue, dispatch };
}
