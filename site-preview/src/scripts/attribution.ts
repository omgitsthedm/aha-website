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
type CheckoutReceipt = { checkoutId: string; checkoutToken: string; quotedAt: number; analyticsWithdrawn?: true; marketingWithdrawn?: true; gpcWithdrawn?: true; withdrawalPending?: true };
type Gtag = (...args: unknown[]) => void;
type TrackingWindow = { gtag?: Gtag; posthog?: { get_distinct_id?: () => unknown; get_session_id?: () => unknown }; __ahaTrackingConsent?: Consent };

const CONSENT_KEY = "aha-cookie-choices-v1";
const ATTRIBUTION_STORAGE = "aha-marketing-attribution-v1";
const CHECKOUT_RECEIPTS_STORAGE = "aha-checkout-marketing-receipts-v1";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const RECEIPT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_RECEIPTS = 10;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;
const SAFE_VALUE = /^[A-Za-z0-9._~-]{1,180}$/;
const SAFE_UTM_VALUE = /^[A-Za-z0-9._~ -]{1,120}$/;
let volatileReceipts: CheckoutReceipt[] = [];

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

function safeReceipt(value: unknown): CheckoutReceipt | undefined {
  if (!value || typeof value !== "object") return undefined;
  const receipt = value as Partial<CheckoutReceipt>;
  if (typeof receipt.checkoutId !== "string" || typeof receipt.checkoutToken !== "string" || typeof receipt.quotedAt !== "number") return undefined;
  if (!SAFE_VALUE.test(receipt.checkoutId) || !SAFE_VALUE.test(receipt.checkoutToken) || receipt.quotedAt > Date.now() || Date.now() - receipt.quotedAt > RECEIPT_MAX_AGE) return undefined;
  if ([receipt.analyticsWithdrawn, receipt.marketingWithdrawn, receipt.gpcWithdrawn, receipt.withdrawalPending].some((flag) => flag !== undefined && flag !== true)) return undefined;
  return {
    checkoutId: receipt.checkoutId, checkoutToken: receipt.checkoutToken, quotedAt: receipt.quotedAt,
    ...(receipt.analyticsWithdrawn ? { analyticsWithdrawn: true } : {}), ...(receipt.marketingWithdrawn ? { marketingWithdrawn: true } : {}),
    ...(receipt.gpcWithdrawn ? { gpcWithdrawn: true } : {}), ...(receipt.withdrawalPending ? { withdrawalPending: true } : {}),
  };
}
function checkoutReceipts() {
  let persisted: CheckoutReceipt[] = [];
  try {
    const value = JSON.parse(localStorage.getItem(CHECKOUT_RECEIPTS_STORAGE) || "[]");
    if (Array.isArray(value)) persisted = value.flatMap((item) => { const receipt = safeReceipt(item); return receipt ? [receipt] : []; });
  } catch { /* Storage is optional. */ }
  const receipts = [...persisted, ...volatileReceipts].flatMap((item) => { const receipt = safeReceipt(item); return receipt ? [receipt] : []; });
  const merged = new Map<string, CheckoutReceipt>();
  for (const receipt of receipts) {
    const key = `${receipt.checkoutId}:${receipt.checkoutToken}`;
    const prior = merged.get(key);
    merged.set(key, {
      ...receipt, quotedAt: Math.max(receipt.quotedAt, prior?.quotedAt || 0),
      ...(receipt.analyticsWithdrawn || prior?.analyticsWithdrawn ? { analyticsWithdrawn: true } : {}),
      ...(receipt.marketingWithdrawn || prior?.marketingWithdrawn ? { marketingWithdrawn: true } : {}),
      ...(receipt.gpcWithdrawn || prior?.gpcWithdrawn ? { gpcWithdrawn: true } : {}),
      ...(receipt.withdrawalPending || prior?.withdrawalPending ? { withdrawalPending: true } : {}),
    });
  }
  return [...merged.values()].sort((a, b) => a.quotedAt - b.quotedAt).slice(-MAX_RECEIPTS);
}
function writeCheckoutReceipts(receipts: CheckoutReceipt[]) {
  try { localStorage.setItem(CHECKOUT_RECEIPTS_STORAGE, JSON.stringify(receipts.slice(-MAX_RECEIPTS))); return true; } catch { return false; }
}
// A quoted checkout may create a server-side delivery context. Do not make one
// unless its opaque receipt can be retained for a later privacy withdrawal.
export function canPersistCheckoutReceipt() {
  const probe = "aha-checkout-receipt-probe";
  try { localStorage.setItem(probe, "1"); localStorage.removeItem(probe); return true; } catch { return false; }
}
export function retainCheckoutReceipt(checkoutId: string, checkoutToken: string) {
  const receipt = safeReceipt({ checkoutId, checkoutToken, quotedAt: Date.now() });
  if (!receipt) return false;
  const receipts = [...checkoutReceipts().filter((item) => item.checkoutId !== receipt.checkoutId), receipt].slice(-MAX_RECEIPTS);
  volatileReceipts = receipts;
  return writeCheckoutReceipts(receipts);
}

function queueCheckoutPrivacyWithdrawal(value: Pick<Consent, "analytics" | "marketing">) {
  const gpc = gpcEnabled();
  if (value.analytics && value.marketing && !gpc) return true;
  const receipts = checkoutReceipts();
  if (!receipts.length) return true;
  const next = receipts.map((receipt) => {
    const analyticsWithdrawn = Boolean(receipt.analyticsWithdrawn || !value.analytics);
    const marketingWithdrawn = Boolean(receipt.marketingWithdrawn || !value.marketing || gpc);
    const gpcWithdrawn = Boolean(receipt.gpcWithdrawn || gpc);
    const newlyNarrowed = analyticsWithdrawn !== Boolean(receipt.analyticsWithdrawn)
      || marketingWithdrawn !== Boolean(receipt.marketingWithdrawn) || gpcWithdrawn !== Boolean(receipt.gpcWithdrawn);
    return {
      ...receipt,
      ...(analyticsWithdrawn ? { analyticsWithdrawn: true as const } : {}), ...(marketingWithdrawn ? { marketingWithdrawn: true as const } : {}),
      ...(gpcWithdrawn ? { gpcWithdrawn: true as const } : {}), ...(receipt.withdrawalPending || newlyNarrowed ? { withdrawalPending: true as const } : {}),
    };
  });
  volatileReceipts = next;
  return writeCheckoutReceipts(next);
}
async function flushCheckoutPrivacyWithdrawal() {
  const receipts = checkoutReceipts().filter((receipt) => receipt.withdrawalPending);
  if (!receipts.length) return true;
  const groups = new Map<string, CheckoutReceipt[]>();
  for (const receipt of receipts) {
    const analytics = !receipt.analyticsWithdrawn;
    const marketing = !receipt.marketingWithdrawn;
    const gpc = Boolean(receipt.gpcWithdrawn);
    const key = `${analytics}:${marketing}:${gpc}`;
    groups.set(key, [...(groups.get(key) || []), receipt]);
  }
  let delivered = true;
  for (const [key, group] of groups) {
    const [analytics, marketing, gpc] = key.split(":").map((value) => value === "true");
    try {
      const response = await fetch("/api/checkout/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ checkouts: group.map(({ checkoutId, checkoutToken }) => ({ checkoutId, checkoutToken })), analytics, marketing, gpc }),
      });
      if (!response.ok) { delivered = false; continue; }
      const deliveredKeys = new Set(group.map((receipt) => `${receipt.checkoutId}:${receipt.checkoutToken}`));
      const sent = new Map(group.map((receipt) => [`${receipt.checkoutId}:${receipt.checkoutToken}`, receipt]));
      const current = checkoutReceipts().map((receipt) => {
        const prior = sent.get(`${receipt.checkoutId}:${receipt.checkoutToken}`);
        if (!prior || !deliveredKeys.has(`${receipt.checkoutId}:${receipt.checkoutToken}`)) return receipt;
        const narrowedSinceRequest = Boolean(receipt.analyticsWithdrawn && !prior.analyticsWithdrawn)
          || Boolean(receipt.marketingWithdrawn && !prior.marketingWithdrawn) || Boolean(receipt.gpcWithdrawn && !prior.gpcWithdrawn);
        return narrowedSinceRequest ? receipt : { ...receipt, withdrawalPending: undefined };
      });
      volatileReceipts = current;
      writeCheckoutReceipts(current);
    } catch { delivered = false; }
  }
  return delivered;
}
export async function withdrawCheckoutPrivacy(value: Pick<Consent, "analytics" | "marketing">) {
  queueCheckoutPrivacyWithdrawal(value);
  return flushCheckoutPrivacyWithdrawal();
}
export function retryCheckoutPrivacyWithdrawal() {
  const current = storedConsent();
  queueCheckoutPrivacyWithdrawal(current);
  void flushCheckoutPrivacyWithdrawal();
}

export function setAttributionConsent(value: Consent) {
  trackingWindow().__ahaTrackingConsent = value;
  if (!value.marketing || gpcEnabled()) clearAttribution();
}

export async function checkoutMarketingEnvelope(options: { requireReceipt?: boolean } = {}): Promise<MarketingEnvelope> {
  const consent = storedConsent();
  const gpc = gpcEnabled();
  const receiptRequired = options.requireReceipt && (consent.analytics || (consent.marketing && !gpc));
  const receiptAvailable = !receiptRequired || canPersistCheckoutReceipt();
  const analyticsAllowed = consent.analytics && receiptAvailable;
  const marketingAllowed = consent.marketing && !gpc && receiptAvailable;
  if (marketingAllowed) captureAttribution(); else clearAttribution();
  const analytics = { consent: analyticsAllowed, ...(analyticsAllowed ? { ...posthogIds(), ...await googleIds() } : {}) };
  const marketing: MarketingEnvelope["marketing"] = { consent: marketingAllowed, gpc };
  if (marketingAllowed) {
    const attribution = readAttribution();
    const meta = { fbp: cookie("_fbp"), fbc: cookie("_fbc") };
    if (attribution) marketing.attribution = attribution;
    if (meta.fbp || meta.fbc) marketing.meta = meta;
  }
  return { analytics, marketing };
}
