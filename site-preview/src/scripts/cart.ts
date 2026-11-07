import { query, queryAll } from "./dom";
import { type SelectionVariant } from "./selection";
import { catalogState, hideRetiredCards } from "./catalog-state";
import offSale from "../data/off-sale.json";
import { checkoutMarketingEnvelope, retainCheckoutReceipt, withdrawCheckoutPrivacy } from "./attribution";

const STORAGE_KEY = "aha-cart-v2";
const PENDING_PAYMENT_KEY = "aha-pending-payment-v1";
const EXPRESS_PENDING_KEY = "aha-pending-express-v1";
const PAYMENT_REVISION_KEY = "aha-payment-revision-v1";
const COMPLETED_ORDER_KEY = "aha-completed-orders-v1";
export const CASH_APP_RESUME_KEY = "aha-cash-app-resume-v1";
export const MAX_QUANTITY = 10;
const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
let volatileCart: Array<{ variationId: string; quantity: number }> | null = null;

type CatalogLine = SelectionVariant & {
  color: string;
  image: string;
  imageAlt: string;
  priceCents: number;
};
export type CartLine = CatalogLine & { variationId: string; quantity: number };
export type CheckoutConfig = {
  appId: string;
  locationId: string;
  countryCode: string;
  currencyCode: string;
  environment?: "sandbox" | "production";
  methods: { card: boolean; applePay: boolean; googlePay: boolean; afterpay: boolean; cashAppPay: boolean; giftCard?: boolean };
};
export type Quote = {
  checkoutId: string;
  checkoutToken: string;
  expiresAt: string;
  currency: string;
  lineItems: Array<{ variationId: string; quantity: number; unitAmount: number; totalAmount: number }>;
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxLabel?: string;
  shippingLabel: string;
  shippingRegion?: string;
};
type TokenResult = { status?: string; token?: string };
export type SquareMethod = { attach?: (target: string, options?: unknown) => Promise<void>; destroy?: () => Promise<void>; tokenize: (details?: unknown) => Promise<TokenResult>; addEventListener?: (name: string, callback: (event: { detail?: { tokenResult?: TokenResult } }) => void) => void };
type SquarePaymentRequest = { addEventListener?: (name: string, callback: (value: unknown) => unknown) => void };
export type SquarePayments = {
  card: () => Promise<SquareMethod>;
  giftCard?: () => Promise<SquareMethod>;
  paymentRequest: (request: unknown) => SquarePaymentRequest;
  applePay?: (request: unknown) => Promise<SquareMethod>;
  googlePay?: (request: unknown) => Promise<SquareMethod>;
  afterpayClearpay?: (request: unknown) => Promise<SquareMethod>;
  cashAppPay?: (request: unknown, options: unknown) => Promise<SquareMethod>;
};
declare global { interface Window { Square?: { payments: (appId: string, locationId: string) => SquarePayments } } }

function safeRead(): unknown[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return volatileCart ?? (Array.isArray(value) ? value : []);
  } catch { return volatileCart ?? []; }
}
export function catalogueFrom(root: ParentNode = document): CatalogLine[] {
  return [...queryAll<HTMLElement>(root, "[data-cart-catalog]")].flatMap((node) => {
    const id = node.dataset.id || "";
    const sku = node.dataset.sku || "";
    const size = node.dataset.size || "";
    const slug = node.dataset.slug || "";
    const title = node.dataset.title || "";
    const color = node.dataset.color || "";
    const priceCents = Number(node.dataset.priceCents);
    const image = node.dataset.image || "";
    const imageAlt = node.dataset.imageAlt || "";
    return id && sku && size && slug && title && color && Number.isSafeInteger(priceCents) && priceCents > 0 && image
      ? [{ id, sku, size, slug, title, color, price: priceCents / 100, priceCents, image, imageAlt }]
      : [];
  });
}
export function normalize(lines: unknown[], catalogue: CatalogLine[]): CartLine[] {
  const allowed = new Map(catalogue.map((line) => [line.id, line]));
  const clean = new Map<string, CartLine>();
  for (const value of lines) {
    if (!value || typeof value !== "object") continue;
    const record = value as { variationId?: unknown; quantity?: unknown };
    const variationId = typeof record.variationId === "string" ? record.variationId : "";
    const quantity = Number(record.quantity);
    const product = allowed.get(variationId);
    if (!product || !Number.isInteger(quantity) || quantity < 1) continue;
    const prior = clean.get(variationId);
    clean.set(variationId, { ...product, variationId, quantity: Math.min(MAX_QUANTITY, (prior?.quantity || 0) + quantity) });
  }
  return [...clean.values()];
}
export function readCart(catalogue: CatalogLine[]) { return normalize(safeRead(), catalogue); }
export function writeCart(lines: CartLine[]) {
  volatileCart = lines.map(({ variationId, quantity }) => ({ variationId, quantity }));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.map(({ variationId, quantity }) => ({ variationId, quantity })))); } catch { /* Storage can be unavailable. */ }
  document.dispatchEvent(new CustomEvent("aha:cart", { detail: { lines } }));
}
function count(lines: CartLine[]) { return lines.reduce((total, line) => total + line.quantity, 0); }
export function displayAmount(cents: number) { return MONEY.format(cents / 100); }
export function freshKey() { return crypto.randomUUID(); }
export type PurchaseSummary = { currency: string; subtotalAmount: number; shippingAmount: number; taxAmount: number; totalAmount: number; items: Array<{ id: string; name: string; unitAmount: number; quantity: number }> };
export type PendingPayment = { checkoutId: string; checkoutToken: string; idempotencyKey: string; createdAt: number; summary?: PurchaseSummary; scope?: "bag" | "product" };
export type CashAppResume = { quote: Quote; address: ReturnType<typeof shippingAddress>; paymentKey: string; fingerprint: string; createdAt: number; revision?: string };
// All payment controls share one durable attempt. Keep legacy records recoverable;
// an unresolved charge must never expire locally into permission to pay again.
let volatilePending: PendingPayment | null = null;
export function readPending(_key?: string): PendingPayment | null {
  for (const key of [PENDING_PAYMENT_KEY, EXPRESS_PENDING_KEY]) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null") as PendingPayment | null;
      if (value && typeof value.checkoutId === "string" && typeof value.checkoutToken === "string" && typeof value.idempotencyKey === "string" && typeof value.createdAt === "number") return { ...value, scope: value.scope ?? (key === EXPRESS_PENDING_KEY ? "product" : "bag") };
    } catch { /* Keep the in-memory lock if browser storage is unavailable. */ }
  }
  return volatilePending;
}
export function paymentRevision() { try { return localStorage.getItem(PAYMENT_REVISION_KEY) || ""; } catch { return ""; } }
export async function claimPending(value: PendingPayment, expectedRevision: string) {
  const claim = () => {
    if (readPending() || paymentRevision() !== expectedRevision) return false;
    // Persist and verify before a payment can leave the browser. A storage
    // failure is a recoverable checkout error, never an untracked charge.
    localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(value));
    if (JSON.parse(localStorage.getItem(PENDING_PAYMENT_KEY) || "null")?.checkoutId !== value.checkoutId) return false;
    localStorage.setItem(PAYMENT_REVISION_KEY, value.checkoutId);
    volatilePending = value;
    document.dispatchEvent(new Event("aha:payment-pending"));
    return true;
  };
  try { return navigator.locks ? await navigator.locks.request("aha-payment", claim) : claim(); }
  catch { return false; }
}
export async function clearPending(checkoutId: string) {
  const clear = () => {
    const current = readPending();
    // A delayed response from another tab may describe an older payment.
    // Serialize settlement with claims, and never clear or unlock its successor.
    if (current && current.checkoutId !== checkoutId) return false;
    if (!current && paymentRevision() && paymentRevision() !== checkoutId) return false;
    if (volatilePending?.checkoutId === checkoutId) volatilePending = null;
    for (const key of [PENDING_PAYMENT_KEY, EXPRESS_PENDING_KEY]) {
      if (JSON.parse(localStorage.getItem(key) || "null")?.checkoutId === checkoutId) localStorage.removeItem(key);
    }
    document.dispatchEvent(new Event("aha:payment-pending"));
    return true;
  };
  try { return navigator.locks ? await navigator.locks.request("aha-payment", clear) : clear(); }
  catch { return false; }
}
window.addEventListener("storage", (event) => {
  if (event.key === PENDING_PAYMENT_KEY || event.key === EXPRESS_PENDING_KEY) volatilePending = null;
  if (event.key === STORAGE_KEY) { volatileCart = null; document.dispatchEvent(new CustomEvent("aha:cart", { detail: { lines: readCart(activeCatalogue()) } })); }
});
export function paymentFailureMessage(code?: string) {
  const messages: Record<string, string> = {
    payment_cvv_failed: "The card’s security code wasn’t accepted. Check the code or choose another payment method.",
    payment_address_failed: "The card’s billing details weren’t accepted. Check the billing details or choose another payment method.",
    payment_card_expired: "The card’s expiry date wasn’t accepted. Check it or choose another payment method.",
    payment_token_expired: "Your secure payment details expired. Enter them again.",
    payment_service_unavailable: "The payment service is temporarily unavailable. Please try again shortly.",
    checkout_paused: "Checkout is temporarily unavailable. No payment was taken. Your bag is saved; please try again shortly.",
  };
  return messages[code || ""] || "Payment could not be completed. Check your details or choose another payment method.";
}
export function readCashAppResume(): CashAppResume | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CASH_APP_RESUME_KEY) || "null") as Partial<CashAppResume> | null;
    const valid = Boolean(value && value.quote && typeof value.quote.checkoutId === "string" && typeof value.quote.checkoutToken === "string" && typeof value.quote.expiresAt === "string" && Number.isFinite(Date.parse(value.quote.expiresAt)) && typeof value.quote.totalAmount === "number" && value.address && typeof value.paymentKey === "string" && typeof value.fingerprint === "string" && typeof value.createdAt === "number" && value.createdAt <= Date.now() && Date.now() - value.createdAt < 15 * 60 * 1000);
    if (valid) return value as CashAppResume;
    sessionStorage.removeItem(CASH_APP_RESUME_KEY);
  } catch { try { sessionStorage.removeItem(CASH_APP_RESUME_KEY); } catch { /* Session storage can be unavailable. */ } }
  return null;
}
export function writeCashAppResume(value: CashAppResume) { try { sessionStorage.setItem(CASH_APP_RESUME_KEY, JSON.stringify(value)); } catch { /* Session storage can be unavailable. */ } }
export function clearCashAppResume() { try { sessionStorage.removeItem(CASH_APP_RESUME_KEY); } catch { /* Session storage can be unavailable. */ } }
function recordCompletedOrder(orderId: string) {
  try {
    const prior = JSON.parse(localStorage.getItem(COMPLETED_ORDER_KEY) || "[]");
    const completed = Array.isArray(prior) ? prior.filter((value): value is string => typeof value === "string").slice(-49) : [];
    if (completed.includes(orderId)) return false;
    completed.push(orderId);
    localStorage.setItem(COMPLETED_ORDER_KEY, JSON.stringify(completed));
  } catch { /* Storage can be unavailable; the event remains tied to this verified completion. */ }
  return true;
}

// Square's script loads only when a shopper is about to pay.
export async function loadSquare(config: CheckoutConfig) {
  if (!window.Square) {
    const script = document.createElement("script"); script.src = config.environment === "sandbox" || config.appId.startsWith("sandbox-") ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js"; script.async = true;
    await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = () => reject(new Error("Square failed to load")); document.head.append(script); });
  }
  if (!window.Square) throw new Error("Square unavailable");
  return window.Square.payments(config.appId, config.locationId);
}
export function emitVerifiedPurchase(orderId: string | undefined, summary: PurchaseSummary | undefined | null) {
  if (!orderId || !summary || !Number.isSafeInteger(summary.subtotalAmount) || !Number.isSafeInteger(summary.shippingAmount) || !Number.isSafeInteger(summary.taxAmount) || !Number.isSafeInteger(summary.totalAmount) || !summary.currency || !summary.items.length || !recordCompletedOrder(orderId)) return;
  document.dispatchEvent(new CustomEvent("aha:purchase-confirmed", { detail: { orderId, value: summary.subtotalAmount / 100, shipping: summary.shippingAmount / 100, tax: summary.taxAmount / 100, currency: summary.currency, items: summary.items.map((item) => ({ id: item.id, name: item.name, price: item.unitAmount / 100, quantity: item.quantity })) } }));
}

export function updateCartLinks(lines: CartLine[]) {
  const itemCount = count(lines);
  queryAll<HTMLElement>(document, "[data-cart-count]").forEach((node) => node.textContent = String(itemCount));
  queryAll<HTMLAnchorElement>(document, "[data-cart-link]").forEach((node) => {
    node.setAttribute("aria-label", `Bag, ${itemCount} ${itemCount === 1 ? "item" : "items"}`);
  });
}
export function activeCatalogue(): CatalogLine[] { return catalogueFrom(document); }

function bumpCount() {
  queryAll<HTMLElement>(document, "[data-cart-count]").forEach((node) => { node.classList.remove("is-bumped"); void node.offsetWidth; node.classList.add("is-bumped"); });
}

function initAddForms() {
  queryAll<HTMLFormElement>(document, "[data-cart-form]").forEach((form) => {
    const variants = queryAll<HTMLInputElement>(form, "[data-cart-variant]");
    // A sole available option is information, not a decision the shopper needs
    // to repeat. Apparel with several fits remains intentionally unselected.
    // The change event lets tracking record the piece as viewed and the wallets
    // start, whichever module's DOMContentLoaded work ran first.
    if (variants.length === 1 && !variants[0]!.checked) { variants[0]!.checked = true; variants[0]!.dispatchEvent(new Event("change", { bubbles: true })); }
    const status = query<HTMLElement>(form, "[data-cart-add-status]");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const buyNow = (event as SubmitEvent).submitter?.hasAttribute("data-buy-now") ?? false;
      const selected = query<HTMLInputElement>(form, "[data-cart-variant]:checked");
      const quantity = Number(query<HTMLInputElement>(form, "[data-cart-quantity]")?.value);
      if (!selected) {
        if (status) status.textContent = "Choose a size before adding this piece.";
        query<HTMLElement>(form, "[data-cart-variant]")?.focus();
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        if (status) status.textContent = "Choose a quantity from 1 to 10.";
        return;
      }
      const catalogue = activeCatalogue();
      const item = catalogue.find((entry) => entry.id === selected.value);
      if (!item) { if (status) status.textContent = "This size is unavailable. Refresh and try again."; return; }
      const current = readCart(catalogue);
      const previous = current.find((line) => line.variationId === item.id);
      const available = MAX_QUANTITY - (previous?.quantity || 0);
      if (available < 1) { if (status) status.textContent = "This size already has the maximum quantity in your bag."; return; }
      const next = previous
        ? current.map((line) => line.variationId === item.id ? { ...line, quantity: line.quantity + Math.min(quantity, available) } : line)
        : [...current, { ...item, variationId: item.id, quantity: Math.min(quantity, available) }];
      writeCart(next);
      updateCartLinks(next);
      bumpCount();
      document.dispatchEvent(new CustomEvent("aha:cart-added", { detail: { id: item.id, name: item.title, size: item.size, color: item.color, price: item.priceCents / 100, quantity: Math.min(quantity, available) } }));
      if (status) {
        const link = document.createElement("a");
        link.href = "/checkout/";
        link.textContent = "View bag and checkout";
        status.replaceChildren(`${item.title}, ${item.size}, added. `, link, ".");
      }
      const added = Math.min(quantity, available);
      // Buy now goes straight to checkout, where the browser can fill in saved details.
      if (buyNow) { location.href = "/checkout/"; return; }
      document.dispatchEvent(new CustomEvent("aha:bag-added", { detail: { title: item.title, size: item.size, image: item.image, added, lineCents: item.priceCents * added, items: count(next), subtotalCents: next.reduce((sum, line) => sum + line.priceCents * line.quantity, 0) } }));
    });
  });
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<{ response: Response; data: T | null }> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null) as T | null;
  return { response, data };
}
export function fieldValue(form: HTMLFormElement, name: string) { return String(new FormData(form).get(name) || "").trim(); }
export function shippingAddress(form: HTMLFormElement) {
  return {
    firstName: fieldValue(form, "firstName"), lastName: fieldValue(form, "lastName"), email: fieldValue(form, "email"), phone: fieldValue(form, "phone") || undefined,
    addressLine1: fieldValue(form, "addressLine1"), addressLine2: fieldValue(form, "addressLine2") || undefined,
    city: fieldValue(form, "city"), region: fieldValue(form, "region"), postalCode: fieldValue(form, "postalCode"), country: fieldValue(form, "country"),
  };
}
export function validAddress(address: ReturnType<typeof shippingAddress>) {
  const required = addressRequirements(address.country);
  return Boolean(address.firstName && address.lastName && address.email && address.addressLine1 && address.city && address.country && (!required.region || address.region) && (!required.postalCode || address.postalCode));
}
// Square records this shipment address and Apliiq requires both province and zip
// for every destination it accepts. Labels can remain localized, but neither
// field can be truthfully optional in this checkout.
export function addressRequirements(_country: string) { return { region: true, postalCode: true }; }
export function squareContact(address: ReturnType<typeof shippingAddress>) {
  return {
    givenName: address.firstName,
    familyName: address.lastName,
    email: address.email,
    phone: address.phone,
    addressLines: [address.addressLine1, address.addressLine2].filter(Boolean),
    city: address.city,
    state: address.region,
    postalCode: address.postalCode,
    countryCode: address.country,
  };
}
export function cartFingerprint(lines: CartLine[], form: HTMLFormElement) {
  return JSON.stringify({ lines: lines.map(({ variationId, quantity }) => [variationId, quantity]), address: shippingAddress(form) });
}
type PayResult = { orderNumber?: string; statusUrl?: string; receiptEmail?: string; state?: string; orderId?: string; receiptUrl?: string; errorCode?: string; error?: string };
export const checkoutItems = (lines: CartLine[]) => lines.map(({ variationId, quantity }) => ({ variationId, quantity }));
export const purchaseSummary = (quote: Quote, lines: CartLine[]): PurchaseSummary => {
  const titles = new Map(lines.map((line) => [line.variationId, line.title]));
  return { currency: quote.currency, subtotalAmount: quote.subtotalAmount, shippingAmount: quote.shippingAmount, taxAmount: quote.taxAmount, totalAmount: quote.totalAmount, items: quote.lineItems.map((item) => ({ id: item.variationId, name: titles.get(item.variationId) || "Item", unitAmount: item.unitAmount, quantity: item.quantity })) };
};
export const quoteCheckout = async (lines: CartLine[], address: ReturnType<typeof shippingAddress>) => {
  const result = await requestJson<Quote & { errorCode?: string }>("/api/checkout/quote", { ...JSON_POST, body: JSON.stringify({ items: checkoutItems(lines), shippingAddress: address, marketing: await checkoutMarketingEnvelope({ requireReceipt: true }) }) });
  if (result.response.ok && result.data && !retainCheckoutReceipt(result.data.checkoutId, result.data.checkoutToken)) void withdrawCheckoutPrivacy({ analytics: false, marketing: false });
  return result;
};
export const paymentStatus = (attempt: Pick<PendingPayment, "checkoutId" | "checkoutToken">) => requestJson<PayResult>(`/api/checkout/status?checkoutId=${encodeURIComponent(attempt.checkoutId)}&checkoutToken=${encodeURIComponent(attempt.checkoutToken)}`);
export const payCheckout = (attempt: PendingPayment, sourceId: string, marketing: Awaited<ReturnType<typeof checkoutMarketingEnvelope>>) => requestJson<PayResult>("/api/checkout/pay", { ...JSON_POST, body: JSON.stringify({ checkoutId: attempt.checkoutId, checkoutToken: attempt.checkoutToken, sourceId, idempotencyKey: attempt.idempotencyKey, marketing }) });
export const emitQuoted = (quote: Quote, summary: PurchaseSummary) => document.dispatchEvent(new CustomEvent("aha:checkout-quoted", { detail: { value: quote.totalAmount / 100, items: summary.items.map(({ id, name, unitAmount, quantity }) => ({ id, name, price: unitAmount / 100, quantity })) } }));
export function setText(root: ParentNode, selector: string, value: string) { const node = query<HTMLElement>(root, selector); if (node) node.textContent = value; }
export function disable(root: ParentNode, selector: string, value: boolean) { queryAll<HTMLButtonElement>(root, selector).forEach((node) => node.disabled = value); }


// Products published live after this page was built join the page catalogue;
// products removed from sale since then leave it, so the bag drops them and
// their product page stops selling. Fetched only when the page sells or holds
// something.
async function syncCatalogue(fresh = false) {
  const known = new Set(catalogueFrom(document).map((line) => line.id));
  const stored = safeRead().map((line) => (line && typeof line === "object" ? (line as { variationId?: unknown }).variationId : null)).filter((id): id is string => typeof id === "string");
  const needed = stored.length > 0 || Boolean(query(document, "[data-cart-form], [data-checkout-page]")) || new URLSearchParams(location.search).has("products");
  if (!needed) return;
  const state = await catalogState({ fresh });
  const removed = new Set(state.retiredVariations);
  queryAll<HTMLElement>(document, "[data-cart-catalog]").forEach((node) => { if (removed.has(node.dataset.id ?? "")) node.remove(); });
  const host = query<HTMLElement>(document, "[data-checkout-page]") ?? document.body;
  for (const line of state.cartLines) {
    if (typeof line.id !== "string" || known.has(line.id) || removed.has(line.id)) continue;
    const template = document.createElement("template");
    template.setAttribute("data-cart-catalog", "");
    for (const [key, value] of Object.entries({ id: line.id, sku: line.sku, size: line.size, slug: line.slug, title: line.title, color: line.color, priceCents: line.priceCents, image: line.image, imageAlt: line.imageAlt })) template.dataset[key] = String(value ?? "");
    host.append(template);
  }
  const slug = /^\/shop\/([a-z0-9-]+)\/$/.exec(location.pathname)?.[1];
  const form = query<HTMLElement>(document, "[data-cart-form]");
  // A piece off sale at build time stays unbuyable unless the server confirms it was restored.
  const builtOffSale = Boolean(slug && offSale.products.includes(slug));
  if (slug && form && (state.retired.includes(slug) || (builtOffSale && !state.known))) {
    const note = document.createElement("p");
    note.className = "checkout-note";
    note.setAttribute("role", "status");
    note.textContent = "This piece is no longer available.";
    form.replaceWith(note);
    // No delivery estimate, Save button or quick-add bar for a piece that can't be bought.
    queryAll(document, "[data-arrival], [data-save], [data-drop]").forEach((element) => element.remove());
  }
  hideRetiredCards(state.retired, state.known);
  document.dispatchEvent(new CustomEvent("aha:catalog-synced"));
}

type Estimate = { totalAmount: number; shippingAmount: number; taxAmount: number; taxLabel?: string | null; shippingLabel: string; errorCode?: string };
type WalletContact = { givenName?: string; familyName?: string; email?: string; phone?: string; addressLines?: string[]; city?: string; state?: string; postalCode?: string; countryCode?: string };
export const JSON_POST = { method: "POST", headers: { "Content-Type": "application/json" } };

// Apple Pay and Google Pay collect a delivery address, the server prices it, then
// quotes and charges through the same checkout session as the bag.
function initExpress() {
  const box = query<HTMLElement>(document, "[data-express]");
  const form = box?.closest<HTMLFormElement>("[data-cart-form]");
  const bag = box?.hasAttribute("data-express-bag") ?? false;
  // A piece off sale has no form by now (syncCatalogue replaced it, and keeps it for
  // a piece restored in the admin). Drops not yet open to everyone are skipped; the
  // server refuses both anyway.
  if (!box || (!bag && (!form || query(document, "[data-drop]")))) return;
  const status = query<HTMLElement>(box, "[data-express-status]")!;
  const apple = query<HTMLButtonElement>(box, "[data-express-apple]")!;
  const google = query<HTMLElement>(box, "[data-express-google]")!;
  let request: (SquarePaymentRequest & { update?: (value: unknown) => boolean }) | null = null;
  let starting: Promise<void> | null = null;
  let shown = 0; // the total the wallet sheet last showed for an address, in cents
  let busy = false;
  let done = false;
  const say = (text: string, charged = false) => { status.textContent = charged ? text : `${text} Nothing was charged.`; };
  const choices = (): CartLine[] => {
    if (bag) return readCart(activeCatalogue());
    if (!form) return [];
    const id = query<HTMLInputElement>(form, "[data-cart-variant]:checked")?.value;
    const quantity = Number(query<HTMLInputElement>(form, "[data-cart-quantity]")?.value);
    const item = activeCatalogue().find((entry) => entry.id === id);
    return item && quantity >= 1 && quantity <= MAX_QUANTITY ? [{ ...item, variationId: item.id, quantity: Math.floor(quantity) }] : [];
  };
  const line = (label: string, cents: number, pending: boolean) => ({ label, amount: (cents / 100).toFixed(2), pending });
  // Shipping and tax stay pending until the wallet shares an address.
  const sheet = (estimate?: Estimate) => {
    const picked = choices();
    const subtotal = picked.reduce((total, item) => total + item.priceCents * item.quantity, 0);
    shown = estimate?.totalAmount ?? 0;
    return {
      lineItems: [...picked.map((item) => line(`${item.title}, ${item.size} × ${item.quantity}`, item.priceCents * item.quantity, false)), line(estimate?.shippingLabel ?? "Shipping", estimate?.shippingAmount ?? 0, !estimate), line(estimate?.taxLabel ?? "Tax", estimate?.taxAmount ?? 0, !estimate)],
      total: line("After Hours Agenda", estimate?.totalAmount ?? subtotal, !estimate),
    };
  };
  const confirmed = (result: PayResult, attempt: PendingPayment) => {
    const summary = attempt.summary!;
    const scope = attempt.scope;
    done = true;
    if (scope === "bag") {
      if (query(document, "[data-checkout-page]")) document.dispatchEvent(new CustomEvent("aha:express-completed", { detail: { ...result, attempt } }));
      else writeCart([]);
    }
    emitVerifiedPurchase(result.orderId, summary);
    apple.hidden = true;
    google.replaceChildren();
    say(`Payment confirmed${result.orderNumber || result.orderId ? ` · order ${result.orderNumber || result.orderId}` : ""}.${result.receiptEmail ? ` Your receipt is addressed to ${result.receiptEmail}.` : ""}`, true);
    if (result.statusUrl) { const link = document.createElement("a"); link.href = result.statusUrl; link.textContent = " View your order and tracking."; status.append(link); }
    if (result.receiptUrl) { const link = document.createElement("a"); link.href = result.receiptUrl; link.textContent = " View receipt."; status.append(link); }
  };
  // A payment Square hasn't confirmed yet: follow it here, never pay again.
  const follow = async (attempt: PendingPayment, tries = 0): Promise<void> => {
    const { data } = await paymentStatus(attempt).catch(() => ({ data: null }));
    if (data?.state === "completed" || data?.state === "failed" || data?.state === "quoted") {
      if (!(await clearPending(attempt.checkoutId))) return;
    }
    if (data?.state === "completed") return confirmed(data, attempt);
    if (data?.state === "failed" || data?.state === "quoted") { done = false; changed(); return say("The payment didn’t go through."); }
    if (data?.state === "attention" || tries > 60) return say("Still confirming this payment. Please don’t pay again; write to info@afterhoursagenda.com.", true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return follow(attempt, tries + 1);
  };
  const pay = (method: SquareMethod) => async () => {
    if (busy || done || readPending()) return;
    const revision = paymentRevision();
    // Tokenize first, inside the tap: Apple Pay only opens from a user gesture.
    busy = true;
    try {
      const result = await method.tokenize() as TokenResult & { details?: { shipping?: { contact?: WalletContact }; billing?: WalletContact } };
      if (result.status !== "OK" || !result.token) return;
      const picked = choices();
      const contact = result.details?.shipping?.contact ?? {};
      const lines = contact.addressLines ?? [];
      const address = { firstName: contact.givenName ?? "", lastName: contact.familyName ?? "", email: contact.email || result.details?.billing?.email || "", phone: contact.phone || undefined, addressLine1: lines[0] ?? "", addressLine2: lines.slice(1).join(", ") || undefined, city: contact.city ?? "", region: contact.state ?? "", postalCode: contact.postalCode ?? "", country: contact.countryCode ?? "" };
      if (!picked.length || !validAddress(address)) return say("Your wallet didn’t share a full address and email.");
      status.textContent = "Confirming your total…";
      const { response, data: quote } = await quoteCheckout(picked, address);
      if (!response.ok || !quote) return say(quote?.errorCode === "early_access_only" ? "This piece isn’t released yet." : "We couldn’t confirm that address.");
      // Charge only the total the shopper saw in the wallet.
      if (quote.totalAmount !== shown) { request?.update?.(sheet()); return say(`The total for that address is ${displayAmount(quote.totalAmount)}; tap to pay again.`); }
      const summary = purchaseSummary(quote, picked);
      emitQuoted(quote, summary);
      status.textContent = "Confirming your payment…";
      // Saved before paying: a reload or lost response is followed, never paid again.
      const attempt: PendingPayment = { checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, idempotencyKey: freshKey(), createdAt: Date.now(), summary, scope: bag ? "bag" : "product" };
      if (!(await claimPending(attempt, revision))) return say(readPending() ? "A previous payment is being checked. Please do not pay again." : "Checkout changed or browser storage is unavailable. Refresh this page before trying again.", Boolean(readPending()));
      let paid: { response: Response; data: PayResult | null };
      try { paid = await payCheckout(attempt, result.token, await checkoutMarketingEnvelope()); } catch { return follow(attempt); }
      if (paid.response.ok && paid.data?.state === "completed") { if (await clearPending(attempt.checkoutId)) confirmed(paid.data, attempt); return; }
      if (paid.response.status === 402 || ["payment_service_unavailable", "checkout_paused"].includes(paid.data?.errorCode || "") || (paid.response.status === 409 && ["quote_expired", "quote_stale"].includes(paid.data?.errorCode || ""))) { if (await clearPending(attempt.checkoutId)) say(paid.response.status === 409 ? "That total expired; tap to pay again." : paymentFailureMessage(paid.data?.errorCode)); return; }
      return follow(attempt);
    } catch { say("Wallet payment isn’t available; use Add to bag."); }
    finally { busy = false; }
  };
  const start = () => starting ??= (async () => {
    const { data: config } = await requestJson<CheckoutConfig>("/api/checkout/config");
    if (!config || (!config.methods.applePay && !config.methods.googlePay)) return;
    const payments = await loadSquare(config);
    request = payments.paymentRequest({ countryCode: "US", currencyCode: "USD", requestShippingContact: true, ...sheet() });
    request.addEventListener?.("shippingcontactchanged", async (value) => {
      const contact = value as WalletContact;
      const picked = choices();
      const { response, data } = picked.length ? await requestJson<Estimate>("/api/checkout/estimate", { ...JSON_POST, body: JSON.stringify({ items: checkoutItems(picked), destination: { country: contact.countryCode, region: contact.state, postalCode: contact.postalCode, city: contact.city } }) }).catch(() => ({ response: null, data: null })) : { response: null, data: null };
      if (response?.ok && data) return sheet(data);
      shown = 0;
      return { error: data?.errorCode === "unsupported_destination" ? "We don’t ship to this country yet." : "We couldn’t price delivery to this address." };
    });
    if (config.methods.applePay && payments.applePay) {
      try { apple.onclick = pay(await payments.applePay(request)); apple.hidden = false; } catch { /* Not Safari, or no card in Wallet. */ }
    }
    if (config.methods.googlePay && payments.googlePay) {
      try { const method = await payments.googlePay(request); await method.attach?.("#aha-express-google", { buttonSizeMode: "fill" }); google.onclick = pay(method); } catch { /* This browser can't use Google Pay. */ }
    }
    box.hidden = apple.hidden && !google.childElementCount;
  })();
  // Wallets load once a size is chosen, so the page itself stays light.
  const changed = () => { if (!done && !readPending() && choices().length) void start().then(() => request?.update?.(sheet())).catch(() => { /* Add to bag still works. */ }); };
  form?.addEventListener("change", changed);
  if (bag) document.addEventListener("aha:cart", changed);
  const lockWallets = () => { const locked = Boolean(readPending()); apple.disabled = locked; google.inert = locked; disable(google, "button", locked); if (!locked) changed(); };
  document.addEventListener("aha:payment-pending", lockWallets);
  window.addEventListener("storage", lockWallets);
  lockWallets();
  // The checkout page owns recovery for both methods; product pages follow it here.
  const saved = readPending(EXPRESS_PENDING_KEY);
  if (saved) { box.hidden = false; say("Checking your last wallet payment…", true); if (!bag) void follow(saved); } else changed();
}

// "Back to your bag" in the bag-reminder email: ?bag=VARIATION:QTY,… puts those
// lines in this browser's bag (on any device), then leaves the address bar clean.
function restoreBagLink() {
  const bag = new URLSearchParams(location.search).get("bag");
  if (!bag) return;
  const catalogue = activeCatalogue();
  const wanted = bag.split(",").slice(0, 20).map((entry) => { const [variationId = "", quantity] = entry.split(":"); return { variationId, quantity: Number(quantity) || 1 }; });
  writeCart(normalize([...readCart(catalogue).filter((line) => !wanted.some((entry) => entry.variationId === line.variationId)), ...wanted], catalogue));
  const url = new URL(location.href);
  url.searchParams.delete("bag");
  history.replaceState(history.state, "", url);
}

async function init() {
  initAddForms();
  // Product-page extras (photo viewer, quick-add bar, bag card) load only where
  // there is something to buy, so the checkout page parses less script.
  const extras = query(document, "[data-cart-form]") ? import("./product-extras") : null;
  void extras?.then((module) => module.initProductExtras());
  restoreBagLink();
  updateCartLinks(readCart(activeCatalogue()));
  // The bag and payment form load only on the checkout page, so product and
  // shop pages parse none of that script. It must be ready before the catalog
  // sync so the bag hears "aha:catalog-synced".
  if (query(document, "[data-checkout-page]")) (await import("./checkout")).initCheckout();
  void syncCatalogue().then(() => {
    // The quick-add bar and wallets wait until a removed product's form has been replaced.
    void extras?.then((module) => module.initBuyBar());
    initExpress();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void syncCatalogue(true);
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { void init(); }, { once: true }); else void init();
