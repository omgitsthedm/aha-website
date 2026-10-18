type Consent = { analytics: boolean; marketing: boolean; at: number };

export type MarketingEnvelope = {
  analytics: { consent: boolean; gaClientId?: string; gaSessionId?: string; posthogDistinctId?: string; posthogSessionId?: string };
  marketing: {
    consent: boolean;
    gpc: boolean;
    attribution?: {
      utm?: Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content", string>>;
      gclid?: string;
      gbraid?: string;
      wbraid?: string;
      fbclid?: string;
      landingPath?: string;
      capturedAt?: string;
    };
    meta?: { fbp?: string; fbc?: string };
  };
};

type StoredAttribution = NonNullable<MarketingEnvelope["marketing"]["attribution"]>;
type Gtag = (...args: unknown[]) => void;
type TrackingWindow = { gtag?: Gtag; posthog?: { get_distinct_id?: () => unknown; get_session_id?: () => unknown }; __ahaTrackingConsent?: Consent };

const CONSENT_KEY = "aha-cookie-choices-v1";
const ATTRIBUTION_STORAGE = "aha-marketing-attribution-v1";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;
const SAFE_VALUE = /^[A-Za-z0-9._~-]{1,180}$/;
const SAFE_UTM_VALUE = /^[A-Za-z0-9._~ -]{1,120}$/;

function gpcEnabled() { return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true; }
function trackingWindow() { return window as unknown as TrackingWindow; }
function storedConsent(): Consent {
  const current = trackingWindow().__ahaTrackingConsent;
  if (current && typeof current.analytics === "boolean" && typeof current.marketing === "boolean") return current;
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null") as Partial<Consent> | null;
    if (value && typeof value.analytics === "boolean" && typeof value.marketing === "boolean" && typeof value.at === "number" && Date.now() - value.at < 180 * 24 * 60 * 60 * 1000) return value as Consent;
  } catch { /* Storage is optional. */ }
  return { analytics: true, marketing: !gpcEnabled(), at: Date.now() };
}
function safeValue(value: string | null, utm = false) {
  if (!value || value.length > (utm ? 120 : 180) || value.includes("@") || /(?:https?:|[?&](?:email|token|password)=)/i.test(value)) return undefined;
  return (utm ? SAFE_UTM_VALUE : SAFE_VALUE).test(value) ? value : undefined;
}
function safePath(value: unknown) { return typeof value === "string" && /^\/[a-z0-9/-]{0,199}$/.test(value) ? value : undefined; }
function cleanParameters(marketingAllowed: boolean, includeMeta = false) {
  const search = new URLSearchParams(location.search);
  const result = new URLSearchParams();
  for (const key of UTM_KEYS) { const value = safeValue(search.get(key), true); if (value) result.set(key, value); }
  if (marketingAllowed) for (const key of ["gclid", "gbraid", "wbraid"] as const) { const value = safeValue(search.get(key)); if (value) result.set(key, value); }
  if (marketingAllowed && includeMeta) { const value = safeValue(search.get("fbclid")); if (value) result.set("fbclid", value); }
  return result;
}
export function cleanTrackingParameters(marketingAllowed: boolean) { return cleanParameters(marketingAllowed); }
function currentAttribution(): StoredAttribution | undefined {
  const search = cleanParameters(true, true);
  const utm = Object.fromEntries(UTM_KEYS.flatMap((key) => {
    const value = safeValue(search.get(key), true);
    return value ? [[key, value]] : [];
  })) as StoredAttribution["utm"];
  const clicks = Object.fromEntries(CLICK_KEYS.flatMap((key) => {
    const value = safeValue(search.get(key));
    return value ? [[key, value]] : [];
  })) as Pick<StoredAttribution, "gclid" | "gbraid" | "wbraid" | "fbclid">;
  if (!Object.keys(utm || {}).length && !Object.keys(clicks).length) return undefined;
  const landingPath = safePath(location.pathname);
  return { ...(Object.keys(utm || {}).length ? { utm } : {}), ...clicks, ...(landingPath ? { landingPath } : {}), capturedAt: new Date().toISOString() };
}
function readAttribution(): StoredAttribution | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(ATTRIBUTION_STORAGE) || "null") as Partial<StoredAttribution> | null;
    const capturedAt = value?.capturedAt;
    const timestamp = typeof capturedAt === "string" ? Date.parse(capturedAt) : NaN;
    if (!value || typeof value !== "object" || !Number.isFinite(timestamp) || timestamp > Date.now() || Date.now() - timestamp > MAX_AGE) return undefined;
    const utm = Object.fromEntries(UTM_KEYS.flatMap((key) => {
      const raw = value.utm && typeof value.utm === "object" ? value.utm[key] : undefined;
      const clean = safeValue(typeof raw === "string" ? raw : null, true);
      return clean ? [[key, clean]] : [];
    })) as StoredAttribution["utm"];
    const clicks = Object.fromEntries(CLICK_KEYS.flatMap((key) => {
      const raw = value[key];
      const clean = safeValue(typeof raw === "string" ? raw : null);
      return clean ? [[key, clean]] : [];
    })) as Pick<StoredAttribution, "gclid" | "gbraid" | "wbraid" | "fbclid">;
    if (!Object.keys(utm || {}).length && !Object.keys(clicks).length) return undefined;
    const landingPath = safePath(value.landingPath);
    return { ...(Object.keys(utm || {}).length ? { utm } : {}), ...clicks, ...(landingPath ? { landingPath } : {}), capturedAt };
  } catch { return undefined; }
}
function cookie(name: string) {
  const prefix = `${name}=`;
  const value = document.cookie.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  return value && SAFE_VALUE.test(value) ? value : undefined;
}
function measurementId() { return document.querySelector<HTMLElement>(".cookie-banner")?.dataset.gaId; }
function analyticsId(value: unknown) { return typeof value === "string" && SAFE_VALUE.test(value) ? value : typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : undefined; }
async function googleIds(): Promise<Pick<MarketingEnvelope["analytics"], "gaClientId" | "gaSessionId">> {
  const id = measurementId();
  const browser = trackingWindow();
  if (!id || !browser.gtag) return {};
  return await new Promise((resolve) => {
    let finished = false;
    const values: Pick<MarketingEnvelope["analytics"], "gaClientId" | "gaSessionId"> = {};
    const finish = () => { if (!finished) { finished = true; resolve(values); } };
    const get = (field: "client_id" | "session_id", target: "gaClientId" | "gaSessionId") => {
      try { browser.gtag?.("get", id, field, (value: unknown) => { const clean = analyticsId(value); if (clean) values[target] = clean; }); } catch { /* Analytics remains optional. */ }
    };
    get("client_id", "gaClientId"); get("session_id", "gaSessionId");
    window.setTimeout(finish, 125);
  });
}
function posthogIds(): Pick<MarketingEnvelope["analytics"], "posthogDistinctId" | "posthogSessionId"> {
  try {
    const distinctId = trackingWindow().posthog?.get_distinct_id?.();
    const sessionId = trackingWindow().posthog?.get_session_id?.();
    return {
      ...(typeof distinctId === "string" && SAFE_VALUE.test(distinctId) ? { posthogDistinctId: distinctId } : {}),
      ...(typeof sessionId === "string" && SAFE_VALUE.test(sessionId) ? { posthogSessionId: sessionId } : {}),
    };
  } catch { return {}; }
}

export function captureAttribution() {
  const consent = storedConsent();
  if (!consent.marketing || gpcEnabled()) { clearAttribution(); return; }
  const value = currentAttribution();
  if (!value) return;
  try { localStorage.setItem(ATTRIBUTION_STORAGE, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}

export function clearAttribution() { try { localStorage.removeItem(ATTRIBUTION_STORAGE); } catch { /* Storage is optional. */ } }

export function setAttributionConsent(value: Consent) {
  trackingWindow().__ahaTrackingConsent = value;
  if (!value.marketing || gpcEnabled()) clearAttribution();
}

export async function checkoutMarketingEnvelope(): Promise<MarketingEnvelope> {
  const consent = storedConsent();
  const gpc = gpcEnabled();
  const marketingAllowed = consent.marketing && !gpc;
  if (marketingAllowed) captureAttribution(); else clearAttribution();
  const analytics = { consent: consent.analytics, ...(consent.analytics ? { ...posthogIds(), ...await googleIds() } : {}) };
  const marketing: MarketingEnvelope["marketing"] = { consent: marketingAllowed, gpc };
  if (marketingAllowed) {
    const attribution = readAttribution();
    const meta = { fbp: cookie("_fbp"), fbc: cookie("_fbc") };
    if (attribution) marketing.attribution = attribution;
    if (meta.fbp || meta.fbc) marketing.meta = meta;
  }
  return { analytics, marketing };
}
