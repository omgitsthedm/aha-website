// The checkout page's bag, delivery form and Square payment methods. Loaded by
// cart.ts only where [data-checkout-page] exists.
import { query, queryAll } from "./dom";
import { recoverSelection } from "./selection";
import { checkoutMarketingEnvelope } from "./attribution";
import { CASH_APP_RESUME_KEY, MAX_QUANTITY, catalogueFrom, normalize, readCart, writeCart, displayAmount, freshKey, readPending, writePending, clearPending, readCashAppResume, writeCashAppResume, clearCashAppResume, loadSquare, emitVerifiedPurchase, updateCartLinks, activeCatalogue, requestJson, fieldValue, shippingAddress, validAddress, addressRequirements, squareContact, cartFingerprint, purchaseSummary, quoteCheckout, paymentStatus, payCheckout, emitQuoted, setText, disable } from "./cart";
import type { CartLine, CheckoutConfig, Quote, SquareMethod, SquarePayments, PurchaseSummary } from "./cart";

export function initCheckout() {
  const page = query<HTMLElement>(document, "[data-checkout-page]");
  if (!page) return;
  const catalogue = catalogueFrom(page);
  const form = query<HTMLFormElement>(page, "[data-checkout-form]");
  const cartLines = query<HTMLElement>(page, "[data-cart-lines]");
  const empty = query<HTMLElement>(page, "[data-cart-empty]");
  const checkout = query<HTMLElement>(page, "[data-checkout-panel]");
  const message = query<HTMLElement>(page, "[data-checkout-message]");
  const summary = query<HTMLElement>(page, "[data-checkout-summary]");
  const checkPaymentStatus = query<HTMLButtonElement>(page, "[data-check-payment-status]");
  const errors = query<HTMLElement>(page, "[data-checkout-errors]");
  if (!form || !cartLines || !empty || !checkout || !message || !summary) return;
  const reportFriction = (reason: "validation" | "quote_failed" | "payment_unavailable") => {
    document.dispatchEvent(new CustomEvent("aha:checkout-friction", { detail: { reason } }));
  };
  const refreshAddressRequirements = () => {
    const required = addressRequirements(fieldValue(form, "country"));
    const region = form.elements.namedItem("region");
    const postalCode = form.elements.namedItem("postalCode");
    const regionOptional = query<HTMLElement>(form, "[data-region-optional]");
    const postalOptional = query<HTMLElement>(form, "[data-postal-optional]");
    if (region instanceof HTMLInputElement) region.required = required.region;
    if (postalCode instanceof HTMLInputElement) postalCode.required = required.postalCode;
    if (regionOptional) regionOptional.hidden = required.region;
    if (postalOptional) postalOptional.hidden = required.postalCode;
  };
  const clearFieldErrors = () => {
    queryAll<HTMLInputElement | HTMLSelectElement>(form, "[aria-invalid='true']").forEach((field) => field.removeAttribute("aria-invalid"));
    if (errors) { errors.hidden = true; errors.replaceChildren(); }
  };
  const showFieldErrors = () => {
    refreshAddressRequirements();
    const labels: Record<string, string> = { firstName: "First name", lastName: "Last name", email: "Email", addressLine1: "Address", city: "City", region: "State, province or region", postalCode: "Postal code", country: "Country" };
    const invalid = Object.entries(labels).flatMap(([name, label]) => {
      const field = form.elements.namedItem(name);
      return field instanceof HTMLInputElement || field instanceof HTMLSelectElement
        ? (!field.checkValidity() ? [{ field, label: name === "email" && field.value ? "a valid email address" : label }] : [])
        : [];
    });
    if (!invalid.length) return false;
    invalid.forEach(({ field }) => field.setAttribute("aria-invalid", "true"));
    if (errors) {
      errors.textContent = `Please correct ${invalid.map(({ label }) => label).join(", ")}.`;
      errors.hidden = false;
    }
    invalid[0]?.field.focus({ preventScroll: false });
    reportFriction("validation");
    return true;
  };
  form.addEventListener("input", clearFieldErrors);
  form.addEventListener("change", (event) => {
    if ((event.target as HTMLInputElement | HTMLSelectElement | null)?.name === "country") refreshAddressRequirements();
    clearFieldErrors();
  });
  refreshAddressRequirements();
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
  if (lines.length) {
    document.dispatchEvent(new CustomEvent("aha:checkout-started", {
      detail: { value: lines.reduce((total, line) => total + line.priceCents * line.quantity, 0) / 100, items: lines.map((line) => ({ id: line.variationId, name: line.title, price: line.priceCents / 100, quantity: line.quantity })) },
    }));
  }
  let config: CheckoutConfig | null = null;
  let quote: Quote | null = null;
  let quotedFingerprint = "";
  let payments: SquarePayments | null = null;
  let card: SquareMethod | null = null;
  let giftCard: SquareMethod | null = null;
  // Which method the pending payment used, for the decline message.
  let paidWithGiftCard = false;
  let walletMethods: SquareMethod[] = [];
  let paymentKey: string = freshKey();
  let pollTimer = 0;
  let unresolvedPayment = readPending();

  const clearQuote = () => {
    quote = null; quotedFingerprint = ""; void card?.destroy?.(); card = null;
    walletMethods.forEach((method) => void method.destroy?.()); walletMethods = [];
    query<HTMLButtonElement>(page, "[data-apple-pay]")!.onclick = null;
    query<HTMLElement>(page, "#aha-google-pay")!.onclick = null;
    clearCashAppResume();
    query<HTMLElement>(page, "#aha-afterpay")!.onclick = null;
    setCheckoutLocked(false);
    window.clearTimeout(pollTimer);
    summary.hidden = true;
    if (checkPaymentStatus) { checkPaymentStatus.hidden = true; checkPaymentStatus.disabled = false; checkPaymentStatus.onclick = null; }
    disable(page, "[data-quote]", false);
    disable(page, "[data-pay-card]", true);
    const wallets = query<HTMLElement>(page, "[data-wallets]")!;
    wallets.hidden = true;
    wallets.style.pointerEvents = "";
    wallets.removeAttribute("aria-busy");
    query<HTMLElement>(page, "#aha-card")!.replaceChildren();
    query<HTMLElement>(page, "#aha-gift-card")?.replaceChildren();
    const giftCardBox = query<HTMLDetailsElement>(page, "[data-gift-card]");
    if (giftCardBox) { giftCardBox.hidden = true; giftCardBox.open = false; }
    disable(page, "[data-pay-gift-card]", true);
    giftCard = null;
    paidWithGiftCard = false;
    ["#aha-google-pay", "#aha-afterpay", "#aha-cash-app"].forEach((selector) => query<HTMLElement>(page, selector)?.replaceChildren());
    query<HTMLButtonElement>(page, "[data-apple-pay]")!.hidden = true;
    setText(page, "[data-card-status]", "Confirm your address to load secure payment options.");
  };
  const renderQuote = () => {
    if (!quote) return;
    setText(summary, "[data-quote-subtotal]", displayAmount(quote.subtotalAmount)); setText(summary, "[data-quote-shipping]", displayAmount(quote.shippingAmount));
    setText(summary, "[data-quote-tax-label]", quote.taxLabel || "Tax"); setText(summary, "[data-quote-tax]", displayAmount(quote.taxAmount)); setText(summary, "[data-quote-total]", displayAmount(quote.totalAmount));
    summary.hidden = false;
  };
  const render = (focusVariationId?: string) => {
    updateCartLinks(lines);
    cartLines.replaceChildren();
    empty.hidden = lines.length > 0;
    checkout.hidden = lines.length === 0;
    let focusTarget: HTMLSelectElement | undefined;
    lines.forEach((line) => {
      const article = document.createElement("article");
      article.className = "bag-line";
      const image = document.createElement("img");
      try {
        const source = new URL(line.image, location.origin);
        if (source.protocol === "https:" || source.origin === location.origin) image.src = source.href;
      } catch { /* A malformed catalogue image should remain empty. */ }
      image.alt = line.imageAlt;
      const details = document.createElement("div");
      const label = document.createElement("p"); label.className = "label"; label.textContent = `${line.size} · ${line.color}`;
      const title = document.createElement("h2"); title.textContent = line.title;
      const price = document.createElement("p"); price.textContent = `${displayAmount(line.priceCents)} each`;
      const quantityLabel = document.createElement("label"); quantityLabel.append("Quantity ");
      const select = document.createElement("select"); select.dataset.cartQuantity = ""; select.setAttribute("aria-label", `${line.title}, ${line.size}, quantity`);
      for (let amount = 1; amount <= MAX_QUANTITY; amount += 1) { const option = new Option(String(amount), String(amount), false, amount === line.quantity); select.add(option); }
      quantityLabel.append(select);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "text-button"; remove.dataset.cartRemove = ""; remove.textContent = "Remove";
      details.append(label, title, price, quantityLabel, remove);
      const total = document.createElement("p"); total.className = "bag-line-total"; total.textContent = displayAmount(line.priceCents * line.quantity);
      article.append(image, details, total);
      select.addEventListener("change", () => {
        lines = lines.map((current) => current.variationId === line.variationId ? { ...current, quantity: Number(select.value) } : current);
        writeCart(lines); clearQuote(); render(line.variationId);
      });
      remove.addEventListener("click", () => {
        const index = lines.findIndex((current) => current.variationId === line.variationId);
        const successor = lines[index + 1]?.variationId || lines[index - 1]?.variationId;
        lines = lines.filter((current) => current.variationId !== line.variationId);
        writeCart(lines); clearQuote(); render(successor);
      });
      cartLines.append(article);
      if (focusVariationId === line.variationId) focusTarget = select;
    });
    setText(page, "[data-cart-subtotal]", displayAmount(lines.reduce((total, line) => total + line.priceCents * line.quantity, 0)));
    focusTarget?.focus({ preventScroll: true });
  };
  const showMessage = (value: string) => { message.textContent = value; message.hidden = false; };
  const showError = showMessage;
  const showFormError = (value: string) => {
    showError(value);
    if (errors) { errors.textContent = value; errors.hidden = false; }
  };
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
    disable(page, "[data-pay-card], [data-pay-gift-card], [data-apple-pay], #aha-google-pay button, #aha-afterpay button, #aha-cash-app button", busy);
    const wallets = query<HTMLElement>(page, "[data-wallets]");
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
    return quote ? purchaseSummary(quote, lines) : null;
  };
  const finishPayment = (orderId?: string, receiptUrl?: string, completedSummary?: PurchaseSummary) => {
    const summary = completedSummary || unresolvedPayment?.summary || quoteSummary();
    clearPending(); unresolvedPayment = null;
    emitVerifiedPurchase(orderId, summary);
    lines = []; writeCart([]); render(); clearQuote();
    checkout.hidden = true;
    empty.hidden = true;
    query<HTMLElement>(page, "[data-cart-subtotal]")!.hidden = true;
    const heading = query<HTMLElement>(page, ".checkout-heading h1");
    const lede = query<HTMLElement>(page, ".checkout-heading .lede");
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
      const { response, data } = await paymentStatus(saved);
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
    const marketing = await checkoutMarketingEnvelope();
    if (!quote || quotedFingerprint !== cartFingerprint(lines, form)) { showError("Your bag or address changed. Confirm the updated total before paying."); clearQuote(); return; }
    clearCashAppResume();
    unresolvedPayment = { checkoutId: quote.checkoutId, checkoutToken: quote.checkoutToken, idempotencyKey: paymentKey, createdAt: Date.now(), summary };
    writePending(unresolvedPayment);
    setCheckoutLocked(true); setPaymentControlsBusy(true); showMessage("Confirming your payment… Please keep this page open.");
    let response: Response;
    let data: { state?: string; orderId?: string; receiptUrl?: string; errorCode?: string } | null;
    try {
      ({ response, data } = await payCheckout(unresolvedPayment, sourceId, marketing));
    } catch {
      showMessage("Payment confirmation is taking longer than usual. We’re checking it safely now—please keep this page open.");
      void poll();
      return;
    }
    if (response.ok && data?.state === "completed") { finishPayment(data.orderId, data.receiptUrl); return; }
    if (response.status === 202 && data?.state === "pending") { showMessage("Payment is processing. We’re confirming it safely now."); void poll(); return; }
    if (response.status === 402) {
      const viaGiftCard = paidWithGiftCard;
      clearPending(); unresolvedPayment = null; paymentKey = freshKey(); clearQuote();
      showError(viaGiftCard ? "That gift card couldn’t pay the full total. Confirm a fresh total, then pay with a card or another method." : "Payment was declined. Check your details or try another method, then confirm a fresh total.");
      return;
    }
    if (response.status === 409 && (data?.errorCode === "quote_expired" || data?.errorCode === "quote_stale")) { clearPending(); unresolvedPayment = null; clearQuote(); showError("That total expired. Confirm your details again for a fresh total."); return; }
    showMessage("Payment confirmation is taking longer than usual. We’re checking it safely now—please keep this page open.");
    void poll();
  };
  const attachWallets = async () => {
    const request = paymentRequest();
    const wallets = query<HTMLElement>(page, "[data-wallets]")!;
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
    const tokenize = (method: SquareMethod) => async () => { if (unresolvedPayment) return; const result = await method.tokenize(); if (result.status === "OK" && result.token) void submitToken(result.token); };
    let any = false;
    any = await setup(config.methods.applePay, payments.applePay?.bind(payments), "#aha-apple-pay", (method) => { const button = query<HTMLButtonElement>(page, "[data-apple-pay]"); if (button) { button.hidden = false; button.onclick = tokenize(method); } }) || any;
    any = await setup(config.methods.googlePay, payments.googlePay?.bind(payments), "#aha-google-pay", (method) => { const target = query<HTMLElement>(page, "#aha-google-pay"); if (target) target.onclick = tokenize(method); }) || any;
    const afterpayEligible = activeQuote.totalAmount >= 1000 && activeQuote.totalAmount <= 200000;
    const afterpayRequest = afterpayPaymentRequest();
    if (config.methods.afterpay && afterpayEligible && afterpayRequest && payments.afterpayClearpay) {
      let method: SquareMethod | null = null;
      try {
        method = await payments.afterpayClearpay.call(payments, afterpayRequest);
        await method.attach?.("#aha-afterpay", { buttonSizeMode: "fill" });
        walletMethods.push(method);
        const target = query<HTMLElement>(page, "#aha-afterpay");
        if (target) target.onclick = tokenize(method);
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
    payments = await loadSquare(config);
    card = await payments.card(); await card.attach?.("#aha-card");
    setText(page, "[data-card-status]", "Card details are encrypted by Square.");
    if (config.methods.giftCard && payments.giftCard) {
      try {
        giftCard = await payments.giftCard();
        await giftCard.attach?.("#aha-gift-card");
        query<HTMLElement>(page, "[data-gift-card]")!.hidden = false;
        disable(page, "[data-pay-gift-card]", false);
      } catch { giftCard = null; /* The account or browser can't take gift cards here; cards still work. */ }
    }
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
    renderQuote();
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
    if (showFieldErrors()) return;
    const address = shippingAddress(form);
    if (!validAddress(address)) { showFormError("Complete your contact and shipping details to see the final total."); return; }
    const quoteButton = query<HTMLButtonElement>(form, "[data-quote]"); if (quoteButton) quoteButton.disabled = true;
    showMessage("Confirming your total…");
    const requestedFingerprint = cartFingerprint(lines, form);
    try {
      const { response, data } = await quoteCheckout(lines, address);
      if (!response.ok || !data) { reportFriction("quote_failed"); showFormError((data as { errorCode?: string } | null)?.errorCode === "early_access_only" ? "A piece in your bag isn’t released yet. Account holders can buy it early: sign in on your account page, or remove it." : "We couldn’t confirm this address. Review it and try again."); return; }
      if (requestedFingerprint !== cartFingerprint(lines, form)) { clearQuote(); showError("Your bag or address changed while the total was loading. Confirm the updated total to continue."); return; }
      quote = data; quotedFingerprint = requestedFingerprint; paymentKey = freshKey();
      renderQuote(); showMessage(`Total confirmed. ${quote.shippingLabel}`);
      emitQuoted(quote, purchaseSummary(quote, lines));
      config ||= (await requestJson<CheckoutConfig>("/api/checkout/config")).data;
      if (!config) throw new Error("Missing checkout config");
      if (!config.methods.card) { setText(page, "[data-card-status]", "Secure card payment is temporarily unavailable. Please try again shortly."); return; }
      await readySquare(); await attachWallets(); disable(page, "[data-pay-card]", false);
    } catch (error) {
      reportFriction("payment_unavailable");
      if (location.hostname !== "afterhoursagenda.com" && location.hostname !== "www.afterhoursagenda.com") {
        const diagnostic = error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError", message: String(error) };
        console.warn("AHA checkout SDK initialization failed", JSON.stringify(diagnostic));
      }
      clearQuote(); showError("Secure payment options are temporarily unavailable. Your bag is saved—please try again shortly.");
    }
    finally { if (quoteButton) quoteButton.disabled = false; }
  });
  query<HTMLButtonElement>(page, "[data-pay-gift-card]")?.addEventListener("click", async () => {
    if (!giftCard || !quote || unresolvedPayment) return;
    const result = await giftCard.tokenize();
    if (result.status === "OK" && result.token) { paidWithGiftCard = true; void submitToken(result.token); }
    else showError("Check the gift card number and try again.");
  });
  query<HTMLButtonElement>(page, "[data-pay-card]")?.addEventListener("click", async () => {
    if (!card || !quote) return;
    paidWithGiftCard = false;
    const address = shippingAddress(form);
    if (unresolvedPayment) return;
    const result = await card.tokenize({ amount: (quote.totalAmount / 100).toFixed(2), currencyCode: quote.currency, intent: "CHARGE", customerInitiated: true, sellerKeyedIn: false, billingContact: { givenName: address.firstName, familyName: address.lastName, email: address.email, phone: address.phone } });
    if (result.status === "OK" && result.token) void submitToken(result.token);
    else showError("Card details weren’t accepted. Check them and try again.");
  });
  document.addEventListener("aha:cart", (event) => { const detail = (event as CustomEvent<{ lines?: CartLine[] }>).detail; if (detail?.lines) { lines = detail.lines; clearQuote(); render(); } });
  document.addEventListener("aha:catalog-synced", () => {
    const reconciled = readCart(activeCatalogue());
    if (JSON.stringify(reconciled.map(({ variationId, quantity }) => [variationId, quantity])) !== JSON.stringify(lines.map(({ variationId, quantity }) => [variationId, quantity]))) {
      lines = reconciled;
      writeCart(lines);
      clearQuote();
      render();
      showMessage("Your bag was refreshed with the current collection.");
    }
  });
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
