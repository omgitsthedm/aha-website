import { recoverSelection, type SelectionVariant } from "./selection";
import { catalogState, hideRetiredCards } from "./catalog-state";

const STORAGE_KEY = "aha-cart-v2";
const PENDING_PAYMENT_KEY = "aha-pending-payment-v1";
const COMPLETED_ORDER_KEY = "aha-completed-orders-v1";
const CASH_APP_RESUME_KEY = "aha-cash-app-resume-v1";
const MAX_QUANTITY = 10;
const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type CatalogLine = SelectionVariant & {
  color: string;
  image: string;
  imageAlt: string;
  priceCents: number;
};
type CartLine = CatalogLine & { variationId: string; quantity: number };
type CheckoutConfig = {
  appId: string;
  locationId: string;
  countryCode: string;
  currencyCode: string;
  environment?: "sandbox" | "production";
  methods: { card: boolean; applePay: boolean; googlePay: boolean; afterpay: boolean; cashAppPay: boolean };
};
type Quote = {
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
type SquareMethod = { attach?: (target: string, options?: unknown) => Promise<void>; destroy?: () => Promise<void>; tokenize: (details?: unknown) => Promise<TokenResult>; addEventListener?: (name: string, callback: (event: { detail?: { tokenResult?: TokenResult } }) => void) => void };
type SquarePaymentRequest = { addEventListener?: (name: string, callback: (value: unknown) => unknown) => void };
type SquarePayments = {
  card: () => Promise<SquareMethod>;
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
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function catalogueFrom(root: ParentNode = document): CatalogLine[] {
  return [...root.querySelectorAll<HTMLElement>("[data-cart-catalog]")].flatMap((node) => {
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
function normalize(lines: unknown[], catalogue: CatalogLine[]): CartLine[] {
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
function readCart(catalogue: CatalogLine[]) { return normalize(safeRead(), catalogue); }
function writeCart(lines: CartLine[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.map(({ variationId, quantity }) => ({ variationId, quantity })))); } catch { /* Storage can be unavailable. */ }
  document.dispatchEvent(new CustomEvent("aha:cart", { detail: { lines } }));
}
function count(lines: CartLine[]) { return lines.reduce((total, line) => total + line.quantity, 0); }
function displayAmount(cents: number) { return MONEY.format(cents / 100); }
function freshKey() { return crypto.randomUUID(); }
type PurchaseSummary = { currency: string; subtotalAmount: number; shippingAmount: number; taxAmount: number; totalAmount: number; items: Array<{ id: string; name: string; unitAmount: number; quantity: number }> };
type PendingPayment = { checkoutId: string; checkoutToken: string; idempotencyKey: string; createdAt: number; summary?: PurchaseSummary };
type CashAppResume = { quote: Quote; address: ReturnType<typeof shippingAddress>; paymentKey: string; fingerprint: string; createdAt: number };
function readPending(): PendingPayment | null {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_PAYMENT_KEY) || "null") as Partial<PendingPayment> | null;
    return value && typeof value.checkoutId === "string" && typeof value.checkoutToken === "string" && typeof value.idempotencyKey === "string" && typeof value.createdAt === "number" && Date.now() - value.createdAt < 24 * 60 * 60 * 1000 ? value as PendingPayment : null;
  } catch { return null; }
}
function writePending(value: PendingPayment) { try { localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(value)); } catch { /* Storage can be unavailable. */ } }
function clearPending() { try { localStorage.removeItem(PENDING_PAYMENT_KEY); } catch { /* Storage can be unavailable. */ } }
function readCashAppResume(): CashAppResume | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CASH_APP_RESUME_KEY) || "null") as Partial<CashAppResume> | null;
    const valid = Boolean(value && value.quote && typeof value.quote.checkoutId === "string" && typeof value.quote.checkoutToken === "string" && typeof value.quote.expiresAt === "string" && Number.isFinite(Date.parse(value.quote.expiresAt)) && typeof value.quote.totalAmount === "number" && value.address && typeof value.paymentKey === "string" && typeof value.fingerprint === "string" && typeof value.createdAt === "number" && value.createdAt <= Date.now() && Date.now() - value.createdAt < 15 * 60 * 1000);
    if (valid) return value as CashAppResume;
    sessionStorage.removeItem(CASH_APP_RESUME_KEY);
  } catch { try { sessionStorage.removeItem(CASH_APP_RESUME_KEY); } catch { /* Session storage can be unavailable. */ } }
  return null;
}
function writeCashAppResume(value: CashAppResume) { try { sessionStorage.setItem(CASH_APP_RESUME_KEY, JSON.stringify(value)); } catch { /* Session storage can be unavailable. */ } }
function clearCashAppResume() { try { sessionStorage.removeItem(CASH_APP_RESUME_KEY); } catch { /* Session storage can be unavailable. */ } }
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

function updateCartLinks(lines: CartLine[]) {
  const itemCount = count(lines);
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((node) => node.textContent = String(itemCount));
  document.querySelectorAll<HTMLAnchorElement>("[data-cart-link]").forEach((node) => {
    node.setAttribute("aria-label", `Bag, ${itemCount} ${itemCount === 1 ? "item" : "items"}`);
  });
}
function activeCatalogue(): CatalogLine[] { return catalogueFrom(document); }

function bumpCount() {
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((node) => { node.classList.remove("is-bumped"); void node.offsetWidth; node.classList.add("is-bumped"); });
}

function initAddForms() {
  document.querySelectorAll<HTMLFormElement>("[data-cart-form]").forEach((form) => {
    const status = form.querySelector<HTMLElement>("[data-cart-add-status]");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = form.querySelector<HTMLInputElement>("[data-cart-variant]:checked");
      const quantity = Number(form.querySelector<HTMLInputElement>("[data-cart-quantity]")?.value);
      if (!selected) {
        if (status) status.textContent = "Choose a size before adding this piece.";
        form.querySelector<HTMLElement>("[data-cart-variant]")?.focus();
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
      if (status) status.innerHTML = `${item.title}, ${item.size}, added. <a href="/checkout/">View bag and checkout</a>.`;
      const added = Math.min(quantity, available);
      document.dispatchEvent(new CustomEvent("aha:bag-added", { detail: { title: item.title, size: item.size, image: item.image, added, lineCents: item.priceCents * added, items: count(next), subtotalCents: next.reduce((sum, line) => sum + line.priceCents * line.quantity, 0) } }));
    });
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<{ response: Response; data: T | null }> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null) as T | null;
  return { response, data };
}
// Anonymous PostHog ids link a quote to its session replay; absent when analytics is off.
function analyticsIds() {
  const posthog = (window as Window & { posthog?: { get_distinct_id?: () => unknown; get_session_id?: () => unknown } }).posthog;
  try {
    const distinctId = posthog?.get_distinct_id?.();
    const sessionId = posthog?.get_session_id?.();
    return typeof distinctId === "string" ? { distinctId, sessionId: typeof sessionId === "string" ? sessionId : undefined } : undefined;
  } catch { return undefined; }
}
function fieldValue(form: HTMLFormElement, name: string) { return String(new FormData(form).get(name) || "").trim(); }
function shippingAddress(form: HTMLFormElement) {
  return {
    firstName: fieldValue(form, "firstName"), lastName: fieldValue(form, "lastName"), email: fieldValue(form, "email"), phone: fieldValue(form, "phone") || undefined,
    addressLine1: fieldValue(form, "addressLine1"), addressLine2: fieldValue(form, "addressLine2") || undefined,
    city: fieldValue(form, "city"), region: fieldValue(form, "region"), postalCode: fieldValue(form, "postalCode"), country: fieldValue(form, "country"),
  };
}
function validAddress(address: ReturnType<typeof shippingAddress>) {
  return Boolean(address.firstName && address.lastName && address.email && address.addressLine1 && address.city && address.region && address.postalCode && address.country);
}
function squareContact(address: ReturnType<typeof shippingAddress>) {
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
function cartFingerprint(lines: CartLine[], form: HTMLFormElement) {
  return JSON.stringify({ lines: lines.map(({ variationId, quantity }) => [variationId, quantity]), address: shippingAddress(form) });
}
function setText(root: ParentNode, selector: string, value: string) { const node = root.querySelector<HTMLElement>(selector); if (node) node.textContent = value; }
function disable(root: ParentNode, selector: string, value: boolean) { root.querySelectorAll<HTMLButtonElement>(selector).forEach((node) => node.disabled = value); }

function initCheckout() {
  const page = document.querySelector<HTMLElement>("[data-checkout-page]");
  if (!page) return;
  const catalogue = catalogueFrom(page);
  const form = page.querySelector<HTMLFormElement>("[data-checkout-form]");
  const cartLines = page.querySelector<HTMLElement>("[data-cart-lines]");
  const empty = page.querySelector<HTMLElement>("[data-cart-empty]");
  const checkout = page.querySelector<HTMLElement>("[data-checkout-panel]");
  const message = page.querySelector<HTMLElement>("[data-checkout-message]");
  const summary = page.querySelector<HTMLElement>("[data-checkout-summary]");
  const checkPaymentStatus = page.querySelector<HTMLButtonElement>("[data-check-payment-status]");
  if (!form || !cartLines || !empty || !checkout || !message || !summary) return;
  let lines = readCart(catalogue);
  const recovered = recoverSelection(location.search, catalogue);
  if (recovered.lines.length) {
    lines = normalize([...lines, ...recovered.lines.map((line) => ({ variationId: line.id, quantity: line.quantity }))], catalogue);
    writeCart(lines);
  }
  if (recovered.incomplete) message.textContent = "Some saved selections are no longer available. Your current bag is shown below.";
  if (new URLSearchParams(location.search).has("products")) {
    const url = new URL(location.href);
    ["products", "coupon", "email"].forEach((key) => url.searchParams.delete(key));
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
  let config: CheckoutConfig | null = null;
  let quote: Quote | null = null;
  let quotedFingerprint = "";
  let payments: SquarePayments | null = null;
  let card: SquareMethod | null = null;
  let walletMethods: SquareMethod[] = [];
  let paymentKey: string = freshKey();
  let pollTimer = 0;
  let unresolvedPayment = readPending();

  const clearQuote = () => {
    quote = null; quotedFingerprint = ""; void card?.destroy?.(); card = null;
    walletMethods.forEach((method) => void method.destroy?.()); walletMethods = [];
    page.querySelector<HTMLButtonElement>("[data-apple-pay]")!.onclick = null;
    page.querySelector<HTMLElement>("#aha-google-pay")!.onclick = null;
    clearCashAppResume();
    page.querySelector<HTMLElement>("#aha-afterpay")!.onclick = null;
    setCheckoutLocked(false);
    window.clearTimeout(pollTimer);
    summary.hidden = true;
    if (checkPaymentStatus) { checkPaymentStatus.hidden = true; checkPaymentStatus.disabled = false; checkPaymentStatus.onclick = null; }
    disable(page, "[data-quote]", false);
    disable(page, "[data-pay-card]", true);
    const wallets = page.querySelector<HTMLElement>("[data-wallets]")!;
    wallets.hidden = true;
    wallets.style.pointerEvents = "";
    wallets.removeAttribute("aria-busy");
    page.querySelector<HTMLElement>("#aha-card")!.replaceChildren();
    ["#aha-google-pay", "#aha-afterpay", "#aha-cash-app"].forEach((selector) => page.querySelector<HTMLElement>(selector)?.replaceChildren());
    page.querySelector<HTMLButtonElement>("[data-apple-pay]")!.hidden = true;
    setText(page, "[data-card-status]", "Confirm your address to load secure payment options.");
  };
  const render = () => {
    updateCartLinks(lines);
    cartLines.innerHTML = "";
    empty.hidden = lines.length > 0;
    checkout.hidden = lines.length === 0;
    lines.forEach((line) => {
      const article = document.createElement("article");
      article.className = "bag-line";
      article.innerHTML = `<img src="${line.image}" alt="${line.imageAlt}"><div><p class="label">${line.size} · ${line.color}</p><h2>${line.title}</h2><p>${displayAmount(line.priceCents)} each</p><label>Quantity <select data-cart-quantity aria-label="${line.title}, ${line.size}, quantity"></select></label><button type="button" class="text-button" data-cart-remove>Remove</button></div><p class="bag-line-total">${displayAmount(line.priceCents * line.quantity)}</p>`;
      const select = article.querySelector<HTMLSelectElement>("[data-cart-quantity]")!;
      for (let amount = 1; amount <= MAX_QUANTITY; amount += 1) { const option = new Option(String(amount), String(amount), false, amount === line.quantity); select.add(option); }
      select.addEventListener("change", () => {
        lines = lines.map((current) => current.variationId === line.variationId ? { ...current, quantity: Number(select.value) } : current);
        writeCart(lines); clearQuote(); render();
      });
      article.querySelector<HTMLButtonElement>("[data-cart-remove]")!.addEventListener("click", () => {
        lines = lines.filter((current) => current.variationId !== line.variationId);
        writeCart(lines); clearQuote(); render();
      });
      cartLines.append(article);
    });
    setText(page, "[data-cart-subtotal]", displayAmount(lines.reduce((total, line) => total + line.priceCents * line.quantity, 0)));
  };
  const showError = (value: string) => { message.textContent = value; message.hidden = false; };
  const showMessage = (value: string) => { message.textContent = value; message.hidden = false; };
  const paymentRequest = () => {
    if (!quote || !config || !payments) return null;
    const address = shippingAddress(form);
    const quotedRegion = quote.shippingRegion || address.region;
    return payments.paymentRequest({
      countryCode: config.countryCode,
      currencyCode: quote.currency,
      total: { amount: (quote.totalAmount / 100).toFixed(2), label: "After Hours Agenda" },
      shippingContact: { ...squareContact(address), state: quotedRegion },
      requestShippingContact: false,
      requestBillingContact: false,
    });
  };
  const afterpayPaymentRequest = () => {
    if (!quote || !config || !payments) return null;
    const address = shippingAddress(form);
    const quotedRegion = quote.shippingRegion || address.region;
    const quoteAmount = (amount: number) => (amount / 100).toFixed(2);
    const shippingOption = {
      id: "quoted-shipping",
      amount: quoteAmount(quote.shippingAmount),
      label: quote.shippingLabel || "Shipping",
      taxLineItems: [{ amount: quoteAmount(quote.taxAmount), label: quote.taxLabel || "Tax" }],
      total: { amount: quoteAmount(quote.totalAmount), label: "After Hours Agenda" },
    };
    const request = payments.paymentRequest({
      countryCode: config.countryCode,
      currencyCode: quote.currency,
      shippingContact: { ...squareContact(address), state: quotedRegion },
      requestShippingContact: true,
      requestBillingContact: false,
      shippingOptions: [shippingOption],
      total: shippingOption.total,
    });
    request.addEventListener?.("afterpay_shippingaddresschanged", (value) => {
      const contact = value as Partial<ReturnType<typeof squareContact>>;
      const normalize = (field: unknown) => String(field || "").trim().toUpperCase().replace(/\s+/g, " ");
      const samePostalCode = (left: unknown, right: unknown) => {
        const a = normalize(left).replace(/\s/g, "");
        const b = normalize(right).replace(/\s/g, "");
        return /^[0-9]{5}(?:-[0-9]{4})?$/.test(a) && /^[0-9]{5}(?:-[0-9]{4})?$/.test(b) ? a.slice(0, 5) === b.slice(0, 5) : a === b;
      };
      const fieldsMatch = Array.isArray(contact.addressLines)
        && normalize(contact.addressLines.join("|")) === normalize([address.addressLine1, address.addressLine2].filter(Boolean).join("|"))
        && normalize(contact.city) === normalize(address.city)
        && normalize(contact.state) === normalize(quotedRegion)
        && samePostalCode(contact.postalCode, address.postalCode)
        && normalize(contact.countryCode) === normalize(address.country);
      return fieldsMatch ? { shippingOptions: [shippingOption] } : { error: "Use the delivery address above, then confirm a fresh total if it needs to change." };
    });
    return request;
  };
  const setPaymentControlsBusy = (busy: boolean) => {
    disable(page, "[data-pay-card], [data-apple-pay], #aha-google-pay button, #aha-afterpay button, #aha-cash-app button", busy);
    const wallets = page.querySelector<HTMLElement>("[data-wallets]");
    if (wallets) {
      wallets.style.pointerEvents = busy ? "none" : "";
      wallets.toggleAttribute("aria-busy", busy);
    }
  };
  const setCheckoutLocked = (busy: boolean) => {
    form.inert = busy;
    cartLines.inert = busy;
    form.toggleAttribute("aria-busy", busy);
    cartLines.toggleAttribute("aria-busy", busy);
  };
  const quoteSummary = (): PurchaseSummary | null => {
    if (!quote) return null;
    const byVariation = new Map(lines.map((line) => [line.variationId, line]));
    return {
      currency: quote.currency,
      subtotalAmount: quote.subtotalAmount,
      shippingAmount: quote.shippingAmount,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      items: quote.lineItems.flatMap((item) => {
        const line = byVariation.get(item.variationId);
        return line ? [{ id: item.variationId, name: line.title, unitAmount: item.unitAmount, quantity: item.quantity }] : [];
      }),
    };
  };
  const emitVerifiedPurchase = (orderId: string | undefined, summary: PurchaseSummary | undefined | null) => {
    if (!orderId || !summary || !Number.isSafeInteger(summary.subtotalAmount) || !Number.isSafeInteger(summary.shippingAmount) || !Number.isSafeInteger(summary.taxAmount) || !Number.isSafeInteger(summary.totalAmount) || !summary.currency || !summary.items.length || !recordCompletedOrder(orderId)) return;
    document.dispatchEvent(new CustomEvent("aha:purchase-confirmed", { detail: { orderId, value: summary.subtotalAmount / 100, shipping: summary.shippingAmount / 100, tax: summary.taxAmount / 100, currency: summary.currency, items: summary.items.map((item) => ({ id: item.id, name: item.name, price: item.unitAmount / 100, quantity: item.quantity })) } }));
  };
  const finishPayment = (orderId?: string, receiptUrl?: string, completedSummary?: PurchaseSummary) => {
    const summary = completedSummary || unresolvedPayment?.summary || quoteSummary();
    clearPending(); unresolvedPayment = null;
    emitVerifiedPurchase(orderId, summary);
    lines = []; writeCart([]); render(); clearQuote();
    checkout.hidden = true;
    empty.hidden = true;
    page.querySelector<HTMLElement>("[data-cart-subtotal]")!.hidden = true;
    const heading = page.querySelector<HTMLElement>(".checkout-heading h1");
    const lede = page.querySelector<HTMLElement>(".checkout-heading .lede");
    if (heading) heading.textContent = "ORDER CONFIRMED.";
    if (lede) lede.textContent = "Thank you. Your payment is complete.";
    message.textContent = `Payment confirmed${orderId ? ` · order ${orderId}` : ""}. Keep this order number; tracking is added to the order when it ships.`;
    if (receiptUrl) { const link = document.createElement("a"); link.href = receiptUrl; link.textContent = " View receipt."; message.append(link); }
    message.hidden = false;
    message.tabIndex = -1;
    message.focus();
  };
  const poll = async (saved = unresolvedPayment || (quote ? { checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, idempotencyKey: paymentKey, createdAt: Date.now(), summary: quoteSummary() || undefined } : null), manual = false) => {
    if (!saved) return;
    try {
      const { response, data } = await requestJson<{ state?: string; orderId?: string; receiptUrl?: string; errorCode?: string }>(`/api/checkout/status?checkoutId=${encodeURIComponent(saved.checkoutId)}&checkoutToken=${encodeURIComponent(saved.checkoutToken)}`);
      if (!response.ok || !data) throw new Error();
      if (data.state === "completed") { finishPayment(data.orderId, data.receiptUrl, saved.summary); return; }
      if (data.state === "attention") {
        const reference = typeof data.orderId === "string" && data.orderId ? ` Order reference: ${data.orderId}.` : "";
        showMessage(`We’re confirming this payment with Square. Please do not try again yet.${reference}`);
        if (checkPaymentStatus) {
          checkPaymentStatus.hidden = false;
          checkPaymentStatus.disabled = false;
          checkPaymentStatus.onclick = () => { checkPaymentStatus.disabled = true; showMessage("Checking payment status with Square…"); void poll(saved, true); };
        }
        const support = document.createElement("a");
        support.href = `mailto:info@afterhoursagenda.com?subject=${encodeURIComponent(`Payment status${typeof data.orderId === "string" && data.orderId ? ` ${data.orderId}` : ""}`)}`;
        support.textContent = "Contact support.";
        message.append(" ", support);
        return;
      }
      if (data.state === "failed" || data.state === "quoted") { clearPending(); unresolvedPayment = null; paymentKey = freshKey(); clearQuote(); showError(data.state === "quoted" ? "Your payment details need to be entered again. Confirm a fresh total to continue." : "Payment could not be completed. Your bag is still here—please try again."); return; }
      if (manual) { if (checkPaymentStatus) checkPaymentStatus.disabled = false; showMessage("The payment is still being confirmed. Please wait, then check status again."); return; }
      pollTimer = window.setTimeout(() => void poll(saved), 1500);
    } catch { pollTimer = window.setTimeout(() => void poll(saved), 2000); }
  };
  const submitToken = async (sourceId: string) => {
    if (unresolvedPayment) return;
    if (!quote || quotedFingerprint !== cartFingerprint(lines, form)) { showError("Your bag or address changed. Confirm the updated total before paying."); clearQuote(); return; }
    const summary = quoteSummary();
    if (!summary) { clearQuote(); showError("Confirm a fresh total before paying."); return; }
    clearCashAppResume();
    unresolvedPayment = { checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, idempotencyKey: paymentKey, createdAt: Date.now(), summary };
    writePending(unresolvedPayment);
    setCheckoutLocked(true); setPaymentControlsBusy(true); showMessage("Confirming your payment… Please keep this page open.");
    let response: Response;
    let data: { state?: string; orderId?: string; receiptUrl?: string; errorCode?: string } | null;
    try {
      ({ response, data } = await requestJson<{ state?: string; orderId?: string; receiptUrl?: string; errorCode?: string }>("/api/checkout/pay", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, sourceId, idempotencyKey: paymentKey }),
      }));
    } catch {
      showMessage("Payment confirmation is taking longer than usual. We’re checking it safely now—please keep this page open.");
      void poll();
      return;
    }
    if (response.ok && data?.state === "completed") { finishPayment(data.orderId, data.receiptUrl); return; }
    if (response.status === 202 && data?.state === "pending") { showMessage("Payment is processing. We’re confirming it safely now."); void poll(); return; }
    if (response.status === 402) {
      clearPending(); unresolvedPayment = null; paymentKey = freshKey(); clearQuote();
      showError("Payment was declined. Check your details or try another method, then confirm a fresh total.");
      return;
    }
    if (response.status === 409 && (data?.errorCode === "quote_expired" || data?.errorCode === "quote_stale")) { clearPending(); unresolvedPayment = null; clearQuote(); showError("That total expired. Confirm your details again for a fresh total."); return; }
    showMessage("Payment confirmation is taking longer than usual. We’re checking it safely now—please keep this page open.");
    void poll();
  };
  const attachWallets = async () => {
    const request = paymentRequest();
    const wallets = page.querySelector<HTMLElement>("[data-wallets]")!;
    const activeQuote = quote;
    if (!request || !config || !payments || !activeQuote) return;
    wallets.hidden = true;
    const setup = async (enabled: boolean, maker: ((value: unknown) => Promise<SquareMethod>) | undefined, target: string, onReady?: (method: SquareMethod) => void) => {
      if (!enabled || !maker) return false;
      let method: SquareMethod | null = null;
      try {
        method = await maker(request);
        await method.attach?.(target, { buttonSizeMode: "fill" });
        walletMethods.push(method);
        onReady?.(method);
        return true;
      } catch {
        void method?.destroy?.();
        return false;
      }
    };
    let any = false;
    any = await setup(config.methods.applePay, payments.applePay?.bind(payments), "#aha-apple-pay", (method) => { const button = page.querySelector<HTMLButtonElement>("[data-apple-pay]"); if (button) { button.hidden = false; button.onclick = async () => { if (unresolvedPayment) return; const result = await method.tokenize(); if (result.status === "OK" && result.token) void submitToken(result.token); }; } }) || any;
    any = await setup(config.methods.googlePay, payments.googlePay?.bind(payments), "#aha-google-pay", (method) => { const target = page.querySelector<HTMLElement>("#aha-google-pay"); if (target) target.onclick = async () => { if (unresolvedPayment) return; const result = await method.tokenize(); if (result.status === "OK" && result.token) void submitToken(result.token); }; }) || any;
    const afterpayEligible = activeQuote.totalAmount >= 1000 && activeQuote.totalAmount <= 200000;
    const afterpayRequest = afterpayPaymentRequest();
    if (config.methods.afterpay && afterpayEligible && afterpayRequest && payments.afterpayClearpay) {
      let method: SquareMethod | null = null;
      try {
        method = await payments.afterpayClearpay.call(payments, afterpayRequest);
        await method.attach?.("#aha-afterpay", { buttonSizeMode: "fill" });
        walletMethods.push(method);
        const target = page.querySelector<HTMLElement>("#aha-afterpay");
        if (target) target.onclick = async () => { if (unresolvedPayment) return; const result = await method!.tokenize(); if (result.status === "OK" && result.token) void submitToken(result.token); };
        any = true;
      } catch { void method?.destroy?.(); }
    }
    if (config.methods.cashAppPay && payments.cashAppPay) {
      try {
        writeCashAppResume({ quote: activeQuote, address: shippingAddress(form), paymentKey, fingerprint: quotedFingerprint, createdAt: Date.now() });
        const method = await payments.cashAppPay.bind(payments)(request, { redirectURL: location.href, referenceId: paymentKey });
        method.addEventListener?.("ontokenization", (event) => { const result = event.detail?.tokenResult; if (result?.status === "OK" && result.token) void submitToken(result.token); });
        await method.attach?.("#aha-cash-app", { width: "full" }); walletMethods.push(method); any = true;
      } catch { /* Browser or account cannot use Cash App Pay. */ }
    }
    wallets.hidden = !any;
  };
  const readySquare = async () => {
    if (!config || !config.methods.card) return;
    if (!window.Square) {
      const script = document.createElement("script"); script.src = config.environment === "sandbox" || config.appId.startsWith("sandbox-") ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js"; script.async = true;
      await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = () => reject(new Error("Square failed to load")); document.head.append(script); });
    }
    if (!window.Square) throw new Error("Square unavailable");
    payments = window.Square.payments(config.appId, config.locationId);
    card = await payments.card(); await card.attach?.("#aha-card");
    setText(page, "[data-card-status]", "Card details are encrypted by Square.");
  };
  const restoreCashAppResume = async () => {
    const hadResume = sessionStorage.getItem(CASH_APP_RESUME_KEY) !== null;
    const saved = readCashAppResume();
    if (!saved || unresolvedPayment || Date.parse(saved.quote.expiresAt) <= Date.now()) { if (hadResume || saved) clearCashAppResume(); return; }
    for (const [name, value] of Object.entries(saved.address)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = value || "";
    }
    if (!validAddress(shippingAddress(form)) || saved.fingerprint !== cartFingerprint(lines, form)) { clearCashAppResume(); return; }
    quote = saved.quote;
    quotedFingerprint = saved.fingerprint;
    paymentKey = saved.paymentKey;
    setText(summary, "[data-quote-subtotal]", displayAmount(quote.subtotalAmount)); setText(summary, "[data-quote-shipping]", displayAmount(quote.shippingAmount));
    setText(summary, "[data-quote-tax-label]", quote.taxLabel || "Tax"); setText(summary, "[data-quote-tax]", displayAmount(quote.taxAmount)); setText(summary, "[data-quote-total]", displayAmount(quote.totalAmount));
    summary.hidden = false;
    try {
      config ||= (await requestJson<CheckoutConfig>("/api/checkout/config")).data;
      if (!config?.methods.card) throw new Error("Missing secure payment configuration");
      await readySquare(); await attachWallets(); disable(page, "[data-pay-card]", false);
      showMessage("Secure payment options restored.");
    } catch {
      clearQuote();
      showError("We couldn’t restore secure payment options. Confirm your total again to continue.");
    }
  };
  form.addEventListener("input", () => { if (quote) { clearQuote(); showMessage("Details changed. Confirm the updated total before paying."); } });
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); message.hidden = true;
    if (unresolvedPayment) { showMessage("We’re still confirming a previous payment attempt. Please keep this page open."); void poll(); return; }
    if (!lines.length) { showError("Your bag is empty."); return; }
    const address = shippingAddress(form);
    if (!validAddress(address)) { showError("Complete your contact and shipping details to see the final total."); return; }
    const quoteButton = form.querySelector<HTMLButtonElement>("[data-quote]"); if (quoteButton) quoteButton.disabled = true;
    showMessage("Confirming your total…");
    const requestedFingerprint = cartFingerprint(lines, form);
    try {
      const { response, data } = await requestJson<Quote>("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: lines.map(({ variationId, quantity }) => ({ variationId, quantity })), shippingAddress: address, analytics: analyticsIds() }) });
      if (!response.ok || !data) { showError("We couldn’t confirm this address. Review it and try again."); return; }
      if (requestedFingerprint !== cartFingerprint(lines, form)) { clearQuote(); showError("Your bag or address changed while the total was loading. Confirm the updated total to continue."); return; }
      quote = data; quotedFingerprint = requestedFingerprint; paymentKey = freshKey();
      setText(summary, "[data-quote-subtotal]", displayAmount(quote.subtotalAmount)); setText(summary, "[data-quote-shipping]", displayAmount(quote.shippingAmount));
      setText(summary, "[data-quote-tax-label]", quote.taxLabel || "Tax"); setText(summary, "[data-quote-tax]", displayAmount(quote.taxAmount)); setText(summary, "[data-quote-total]", displayAmount(quote.totalAmount));
      summary.hidden = false; showMessage(`Total confirmed. ${quote.shippingLabel}`);
      document.dispatchEvent(new CustomEvent("aha:checkout-quoted", { detail: { value: quote.totalAmount / 100, items: lines.map((line) => ({ id: line.variationId, name: line.title, price: line.priceCents / 100, quantity: line.quantity })) } }));
      config ||= (await requestJson<CheckoutConfig>("/api/checkout/config")).data;
      if (!config) throw new Error("Missing checkout config");
      if (!config.methods.card) { setText(page, "[data-card-status]", "Secure card payment is temporarily unavailable. Please try again shortly."); return; }
      await readySquare(); await attachWallets(); disable(page, "[data-pay-card]", false);
    } catch (error) {
      if (location.hostname !== "afterhoursagenda.com" && location.hostname !== "www.afterhoursagenda.com") {
        const diagnostic = error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) };
        console.warn("AHA checkout SDK initialization failed", JSON.stringify(diagnostic));
      }
      clearQuote(); showError("Secure payment options are temporarily unavailable. Your bag is saved—please try again shortly.");
    }
    finally { if (quoteButton) quoteButton.disabled = false; }
  });
  page.querySelector<HTMLButtonElement>("[data-pay-card]")?.addEventListener("click", async () => {
    if (!card || !quote) return;
    const address = shippingAddress(form);
    if (unresolvedPayment) return;
    const result = await card.tokenize({ amount: (quote.totalAmount / 100).toFixed(2), currencyCode: quote.currency, intent: "CHARGE", customerInitiated: true, sellerKeyedIn: false, billingContact: { givenName: address.firstName, familyName: address.lastName, email: address.email, phone: address.phone } });
    if (result.status === "OK" && result.token) void submitToken(result.token);
    else showError("Card details weren’t accepted. Check them and try again.");
  });
  document.addEventListener("aha:cart", (event) => { const detail = (event as CustomEvent<{ lines?: CartLine[] }>).detail; if (detail?.lines) { lines = detail.lines; clearQuote(); render(); } });
  render();
  if (unresolvedPayment) {
    disable(page, "[data-quote]", true);
    setCheckoutLocked(true);
    showMessage("We’re checking a previous payment attempt before offering checkout again.");
    void poll(unresolvedPayment);
  } else {
    void restoreCashAppResume();
  }
}

// Products published live after this page was built join the page catalogue;
// products removed from sale since then leave it, so the bag drops them and
// their product page stops selling. Fetched only when the page sells or holds
// something.
async function syncCatalogue() {
  const known = new Set(catalogueFrom(document).map((line) => line.id));
  const stored = safeRead().map((line) => (line && typeof line === "object" ? (line as { variationId?: unknown }).variationId : null)).filter((id): id is string => typeof id === "string");
  const needed = stored.length > 0 || Boolean(document.querySelector("[data-cart-form], [data-checkout-page]")) || new URLSearchParams(location.search).has("products");
  if (!needed) return;
  const state = await catalogState();
  const removed = new Set(state.retiredVariations);
  document.querySelectorAll<HTMLElement>("[data-cart-catalog]").forEach((node) => { if (removed.has(node.dataset.id ?? "")) node.remove(); });
  const host = document.querySelector<HTMLElement>("[data-checkout-page]") ?? document.body;
  for (const line of state.cartLines) {
    if (typeof line.id !== "string" || known.has(line.id) || removed.has(line.id)) continue;
    const template = document.createElement("template");
    template.setAttribute("data-cart-catalog", "");
    for (const [key, value] of Object.entries({ id: line.id, sku: line.sku, size: line.size, slug: line.slug, title: line.title, color: line.color, priceCents: line.priceCents, image: line.image, imageAlt: line.imageAlt })) template.dataset[key] = String(value ?? "");
    host.append(template);
  }
  const slug = /^\/shop\/([a-z0-9-]+)\/$/.exec(location.pathname)?.[1];
  const form = document.querySelector<HTMLElement>("[data-cart-form]");
  if (slug && form && state.retired.includes(slug)) {
    const note = document.createElement("p");
    note.className = "checkout-note";
    note.setAttribute("role", "status");
    note.textContent = "This piece is no longer available.";
    form.replaceWith(note);
  }
  hideRetiredCards(state.retired);
}

async function init() {
  initAddForms();
  // Product-page extras (photo viewer, quick-add bar, bag card) load only where
  // there is something to buy, so the checkout page parses less script.
  const extras = document.querySelector("[data-cart-form]") ? import("./product-extras") : null;
  void extras?.then((module) => module.initProductExtras());
  await syncCatalogue();
  // The quick-add bar waits until a removed product's form has been replaced.
  void extras?.then((module) => module.initBuyBar());
  updateCartLinks(readCart(activeCatalogue()));
  initCheckout();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { void init(); }, { once: true }); else void init();
