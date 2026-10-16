// Server-side PostHog events for checkout milestones. They reuse the visitor's
// anonymous PostHog ids, so a quote or purchase lines up with its session
// replay. Properties carry amounts and product ids only, never customer details.

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;
const DEFAULT_HOST = "https://us.i.posthog.com";

/** Accept only the shape of PostHog's random ids; anything else is dropped. */
export function normalizeAnalyticsIds(value) {
  const distinctId = typeof value?.distinctId === "string" && ID_PATTERN.test(value.distinctId) ? value.distinctId : null;
  const sessionId = typeof value?.sessionId === "string" && ID_PATTERN.test(value.sessionId) ? value.sessionId : null;
  return { distinctId, sessionId };
}

export function posthogConfig(env) {
  const key = env.get("POSTHOG_PROJECT_KEY") || env.get("PUBLIC_POSTHOG_KEY") || "";
  const host = env.get("POSTHOG_HOST") || env.get("PUBLIC_POSTHOG_HOST") || DEFAULT_HOST;
  return { key, host };
}

/** Returns capture(event, ids, properties) → Promise<boolean>. Never throws. */
export function createPostHogCapture({ key, host = DEFAULT_HOST, fetchImpl = fetch, timeoutMs = 1500, now = () => new Date() }) {
  if (!key) return async () => false;
  let endpoint;
  try {
    const url = new URL(host);
    if (url.protocol !== "https:") return async () => false;
    endpoint = new URL("/i/v0/e/", url).href;
  } catch { return async () => false; }
  return async function capture(event, ids, properties = {}) {
    const { distinctId, sessionId } = normalizeAnalyticsIds(ids);
    if (!distinctId) return false;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event,
          distinct_id: distinctId,
          timestamp: now().toISOString(),
          properties: { ...properties, ...(sessionId ? { $session_id: sessionId } : {}), $lib: "aha-server" },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.ok;
    } catch { return false; }
  };
}

/** Run a capture after the response when the platform supports waitUntil. */
export function afterResponse(context, promise) {
  const settled = Promise.resolve(promise).catch(() => false);
  if (typeof context?.waitUntil === "function") { context.waitUntil(settled); return Promise.resolve(null); }
  return settled;
}

/** Checkout milestone properties: amounts and product ids only. */
export function checkoutProperties({ totalCents, items }) {
  const lines = Array.isArray(items) ? items : [];
  return {
    value: Number.isFinite(totalCents) ? totalCents / 100 : undefined,
    currency: "USD",
    item_count: lines.reduce((sum, line) => sum + (Number(line?.quantity) || 0), 0),
    product_ids: lines.map((line) => line?.variationId).filter((id) => typeof id === "string"),
  };
}
