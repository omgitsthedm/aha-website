import { test, expect } from "./fixtures";

const quote = {
  checkoutId: "checkout_test_1",
  checkoutToken: "safe-checkout-token",
  expiresAt: "2030-01-01T00:00:00.000Z",
  currency: "USD",
  lineItems: [{ variationId: "R5UCZCGSJMR3Z4HJDVOD3ZIK", quantity: 1, unitAmount: 5200, totalAmount: 5200 }],
  subtotalAmount: 5200,
  shippingAmount: 0,
  taxAmount: 421,
  totalAmount: 5621,
  taxLabel: "Arizona TPT",
  shippingLabel: "Free domestic shipping",
  shippingRegion: "AZ",
};

async function fillAddress(page: import("@playwright/test").Page) {
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email").fill("avery@example.com");
  await page.getByLabel("Address").fill("1 N Central Ave");
  await page.getByLabel("City").fill("Phoenix");
  await page.getByLabel("State / province").fill("AZ");
  await page.getByLabel("Postal code").fill("85004");
}
async function mockSquare(page: import("@playwright/test").Page, cashApp = false) {
  await page.addInitScript((cash) => {
    const state = window as Window & { __ahaPaymentRequest?: unknown; __ahaAfterpayRequest?: unknown; __ahaAfterpayAddressListener?: (contact: unknown) => unknown; __ahaCashReferences?: string[] };
    state.__ahaCashReferences = [];
    window.Square = { payments: () => ({
      card: async () => ({ attach: async () => {}, tokenize: async () => ({ status: "OK", token: "opaque-square-token" }) }),
      giftCard: async () => ({ attach: async () => {}, tokenize: async () => ({ status: "OK", token: "opaque-gift-card-token" }) }),
      paymentRequest: (request: unknown) => {
        if (!state.__ahaPaymentRequest) state.__ahaPaymentRequest = request;
        return { options: request, addEventListener: (name: string, listener: (contact: unknown) => unknown) => { if (name === "afterpay_shippingaddresschanged") state.__ahaAfterpayAddressListener = listener; } };
      },
      afterpayClearpay: async (request: unknown) => { state.__ahaAfterpayRequest = request; return { attach: async () => {}, tokenize: async () => ({ status: "OK", token: "opaque-afterpay-token" }) }; },
      cashAppPay: cash ? async (_request: unknown, options: unknown) => { const referenceId = (options as { referenceId?: unknown }).referenceId; if (typeof referenceId === "string") state.__ahaCashReferences?.push(referenceId); return { attach: async () => {}, tokenize: async () => ({ status: "OK", token: "opaque-cash-token" }), addEventListener: () => {} }; } : undefined,
    }) };
  }, cashApp);
}

test("checkout: server quote then card payment never sends client money", async ({ page }) => {
  const quoteBodies: unknown[] = [];
  const paymentBodies: Record<string, unknown>[] = [];
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", async (route) => {
    quoteBodies.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) });
  });
  await page.route("**/api/checkout/pay", async (route) => {
    paymentBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ state: "completed", orderId: "AHA-1001", paymentId: "payment_test" }) });
  });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  // Production activation installs its own gtag queue during navigation. Replace it
  // after activation so the quote exercises the GA identifier callback path.
  await page.evaluate(() => {
    (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag = (...args) => {
      const callback = args[3];
      if (args[0] === "get" && typeof callback === "function") callback(args[2] === "session_id" ? 123456 : "12345.678");
    };
  });
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.locator("[data-quote-total]")).toHaveText("$56.21");
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeEnabled();
  expect(await page.evaluate(() => (window as Window & { __ahaPaymentRequest?: unknown }).__ahaPaymentRequest)).toMatchObject({
    requestShippingContact: false,
    requestBillingContact: false,
    shippingContact: { givenName: "Avery", familyName: "Tester", addressLines: ["1 N Central Ave"], city: "Phoenix", state: "AZ", postalCode: "85004", countryCode: "US" },
  });
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page.locator("[data-checkout-message]")).toContainText("Payment confirmed · order AHA-1001");
  await expect(page.getByRole("heading", { name: "ORDER CONFIRMED." })).toBeVisible();
  await expect(page.locator(".checkout-heading .lede")).toHaveText("Thank you. Your payment is complete.");
  await expect(page.locator("[data-cart-empty]")).toBeHidden();
  await expect(page.locator("[data-cart-subtotal]")).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.matches("[data-checkout-message]"))).toBe(true);
  // The quote carries only a consent-gated, anonymous marketing envelope; never contact data or money.
  expect(quoteBodies).toHaveLength(1);
  const { marketing, ...quoteBody } = quoteBodies[0] as Record<string, unknown>;
  expect(quoteBody).toEqual({ items: [{ variationId: "R5UCZCGSJMR3Z4HJDVOD3ZIK", quantity: 1 }], shippingAddress: { firstName: "Avery", lastName: "Tester", email: "avery@example.com", addressLine1: "1 N Central Ave", city: "Phoenix", region: "AZ", postalCode: "85004", country: "US" } });
  expect(marketing).toMatchObject({ analytics: { consent: true, gaClientId: "12345.678", gaSessionId: "123456" }, marketing: { consent: true, gpc: false } });
  expect(JSON.stringify(marketing)).not.toMatch(/Avery|Tester|avery@example\.com|1 N Central Ave|Phoenix/);
  expect(paymentBodies).toHaveLength(1);
  expect(paymentBodies[0]).toMatchObject({ checkoutId: "checkout_test_1", checkoutToken: "safe-checkout-token", sourceId: "opaque-square-token" });
  expect(paymentBodies[0]).not.toHaveProperty("totalAmount");
  expect(paymentBodies[0]).not.toHaveProperty("price");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("opaque-square-token");
});

test("checkout: privacy choices retain and narrow the quoted server context across later choices", async ({ page }) => {
  const privacyBodies: Record<string, unknown>[] = [];
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: false, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/checkout/privacy", async (route) => {
    privacyBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ accepted: true, updated: 1 }) });
  });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("aha-checkout-marketing-receipts-v1"))).not.toBeNull();
  await page.getByRole("button", { name: "Privacy choices", exact: true }).click();
  await page.getByRole("button", { name: "Analytics only", exact: true }).click();
  await expect.poll(() => privacyBodies.length).toBe(1);
  expect(privacyBodies[0]).toEqual({ checkouts: [{ checkoutId: "checkout_test_1", checkoutToken: "safe-checkout-token" }], analytics: true, marketing: false, gpc: false });
  await page.getByRole("button", { name: "Privacy choices", exact: true }).click();
  await page.getByRole("button", { name: "Essential only", exact: true }).click();
  await expect.poll(() => privacyBodies.length).toBe(2);
  expect(privacyBodies[1]).toEqual({ checkouts: [{ checkoutId: "checkout_test_1", checkoutToken: "safe-checkout-token" }], analytics: false, marketing: false, gpc: false });
  expect(JSON.stringify(privacyBodies)).not.toMatch(/Avery|Tester|avery@example\.com|1 N Central Ave|Phoenix/);
});

test("checkout: a failed privacy withdrawal is retried after navigation", async ({ page }) => {
  const privacyBodies: Record<string, unknown>[] = [];
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: false, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/checkout/privacy", async (route) => {
    privacyBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (privacyBodies.length === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
    else await route.fulfill({ contentType: "application/json", body: JSON.stringify({ accepted: true, updated: 1 }) });
  });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("aha-checkout-marketing-receipts-v1"))).not.toBeNull();
  await page.getByRole("button", { name: "Privacy choices", exact: true }).click();
  // A saved choice reloads the page after giving the withdrawal 250 ms; a goto
  // issued during that reload is aborted, so wait for it like the test below.
  const reload = page.waitForNavigation({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Analytics only", exact: true }).click();
  await reload;
  // The failed same-origin withdrawal leaves a receipt locally; the next page
  // load, rather than a timer retry, submits that receipt once, and a further
  // load does not submit it again.
  await expect.poll(() => privacyBodies.length).toBe(2);
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await page.waitForLoadState("networkidle");
  expect(privacyBodies.length).toBe(2);
  expect(privacyBodies).toEqual([
    { checkouts: [{ checkoutId: "checkout_test_1", checkoutToken: "safe-checkout-token" }], analytics: true, marketing: false, gpc: false },
    { checkouts: [{ checkoutId: "checkout_test_1", checkoutToken: "safe-checkout-token" }], analytics: true, marketing: false, gpc: false },
  ]);
});

test("checkout: rejects tampered or future saved attribution", async ({ page }) => {
  const quoteBodies: Record<string, unknown>[] = [];
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: false, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", async (route) => { quoteBodies.push(route.request().postDataJSON() as Record<string, unknown>); await route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await page.evaluate(() => localStorage.setItem("aha-marketing-attribution-v1", JSON.stringify({ utm: { utm_source: "private@example.com" }, gclid: "unsafe@email", landingPath: "/checkout/?token=private", capturedAt: "2999-01-01T00:00:00.000Z" })));
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect.poll(() => quoteBodies.length).toBe(1);
  expect((quoteBodies[0]!.marketing as { marketing: { attribution?: unknown } }).marketing.attribution).toBeUndefined();
});

test("checkout: keeps only allowed campaign values and drops them after a marketing opt-out", async ({ page }) => {
  const quoteBodies: Record<string, unknown>[] = [];
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: false, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", async (route) => { quoteBodies.push(route.request().postDataJSON() as Record<string, unknown>); await route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1&utm_source=google&utm_campaign=fall-2026&gclid=google-click_1&fbclid=meta-click_1&email=private%40example.com&token=do-not-keep");
  await page.evaluate(() => { document.cookie = "_fbp=fb.1.123.abc_1; path=/"; document.cookie = "_fbc=fb.1.123.meta_1; path=/"; });
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect.poll(() => quoteBodies.length).toBe(1);
  const first = quoteBodies[0]!.marketing as { marketing: { attribution?: Record<string, unknown>; meta?: Record<string, unknown> } };
  expect(first.marketing.attribution).toMatchObject({ utm: { utm_source: "google", utm_campaign: "fall-2026" }, gclid: "google-click_1", fbclid: "meta-click_1", landingPath: "/checkout/" });
  expect(first.marketing.meta).toEqual({ fbp: "fb.1.123.abc_1", fbc: "fb.1.123.meta_1" });
  expect(JSON.stringify(first)).not.toMatch(/private%40example|do-not-keep|email|token/);

  await page.getByRole("button", { name: "Privacy choices", exact: true }).click();
  const reload = page.waitForNavigation({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Analytics only", exact: true }).click();
  await reload;
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email").fill("avery@example.com");
  await page.getByLabel("Address").fill("1 N Central Ave");
  await page.getByLabel("City").fill("Phoenix");
  await page.getByLabel("State / province").fill("AZ");
  await page.getByLabel("Postal code").fill("85004");
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect.poll(() => quoteBodies.length).toBe(2);
  expect((quoteBodies[1]!.marketing as { marketing: unknown }).marketing).toEqual({ consent: false, gpc: false });
  expect(await page.evaluate(() => localStorage.getItem("aha-marketing-attribution-v1"))).toBeNull();
});

test("checkout: payment uses the latest privacy choice even when a prior quote allowed marketing", async ({ page }) => {
  const paymentBodies: Record<string, unknown>[] = [];
  const quoteBodies: Record<string, unknown>[] = [];
  await page.addInitScript(() => Object.defineProperty(Storage.prototype, "setItem", { configurable: true, value: () => { throw new DOMException("Storage blocked"); } }));
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", async (route) => { quoteBodies.push(route.request().postDataJSON() as Record<string, unknown>); await route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }); });
  await page.route("**/api/checkout/pay", async (route) => { paymentBodies.push(route.request().postDataJSON() as Record<string, unknown>); await route.fulfill({ contentType: "application/json", body: JSON.stringify({ state: "completed", orderId: "AHA-consent-1002" }) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1&utm_source=google&gclid=google-click_2");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect.poll(() => quoteBodies.length).toBe(1);
  expect(quoteBodies[0]!.marketing).toEqual({ analytics: { consent: false }, marketing: { consent: false, gpc: false } });
  await page.getByRole("button", { name: "Privacy choices", exact: true }).click();
  await page.getByRole("button", { name: "Analytics only", exact: true }).click();
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect.poll(() => paymentBodies.length).toBe(1);
  expect(paymentBodies[0]!.marketing).toMatchObject({ analytics: { consent: true }, marketing: { consent: false, gpc: false } });
  expect(JSON.stringify(paymentBodies[0]!.marketing)).not.toContain("google-click_2");
});

test("checkout: ambiguous payment is recovered through status without a second charge", async ({ page }) => {
  let pays = 0;
  let statuses = 0;
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/checkout/pay", (route) => { pays += 1; return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ state: "pending", checkoutId: quote.checkoutId }) }); });
  await page.route("**/api/checkout/status**", (route) => { statuses += 1; return route.fulfill({ contentType: "application/json", body: JSON.stringify({ state: "completed", orderId: "AHA-1002" }) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page.locator("[data-checkout-message]")).toContainText("Payment confirmed · order AHA-1002");
  expect(pays).toBe(1);
  expect(statuses).toBeGreaterThanOrEqual(1);
});


test("checkout: an ambiguous service response is reconciled before checkout unlocks", async ({ page }) => {
  let pays = 0;
  let statuses = 0;
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/checkout/pay", (route) => { pays += 1; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ errorCode: "checkout_unavailable" }) }); });
  await page.route("**/api/checkout/status**", (route) => { statuses += 1; return route.fulfill({ contentType: "application/json", body: JSON.stringify({ state: "completed", orderId: "AHA-1003" }) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page.locator("[data-checkout-message]")).toContainText("Payment confirmed · order AHA-1003");
  expect(pays).toBe(1);
  expect(statuses).toBeGreaterThanOrEqual(1);
});

test("checkout: an unprovable payment outcome stays locked and only rechecks on request", async ({ page }) => {
  let statuses = 0;
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/checkout/pay", (route) => route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ state: "pending", checkoutId: quote.checkoutId }) }));
  await page.route("**/api/checkout/status**", (route) => { statuses += 1; return route.fulfill({ contentType: "application/json", body: JSON.stringify({ state: "attention", error: "payment_outcome_unknown", orderId: "AHA-hold-1004" }) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page.locator("[data-checkout-message]")).toContainText("Order reference: AHA-hold-1004");
  await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible();
  expect(await page.evaluate(() => ({ form: document.querySelector<HTMLFormElement>("[data-checkout-form]")?.inert, cart: document.querySelector<HTMLElement>("[data-cart-lines]")?.inert, pending: Boolean(localStorage.getItem("aha-pending-payment-v1")) }))).toEqual({ form: true, cart: true, pending: true });
  await page.getByRole("button", { name: "Check payment status" }).click();
  await expect.poll(() => statuses).toBe(2);
  await expect(page.locator("[data-checkout-message]")).toContainText("Please do not try again yet");
});

test("checkout: Afterpay keeps its delivery contact bound to the server quote", async ({ page }) => {
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: true, cashAppPay: false } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...quote, shippingRegion: "NY" }) }));
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByLabel("State / province").fill("New York");
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeEnabled();
  expect(await page.evaluate(() => {
    const state = window as Window & { __ahaAfterpayRequest?: { options?: { requestShippingContact?: boolean; shippingContact?: unknown; total?: unknown } }; __ahaAfterpayAddressListener?: (contact: unknown) => unknown };
    const matching = state.__ahaAfterpayAddressListener?.({ addressLines: ["1  n  central ave"], city: " phoenix ", state: "ny", postalCode: "85004-1234", countryCode: "us" });
    const mismatch = state.__ahaAfterpayAddressListener?.({ addressLines: ["2 Elsewhere Ave"], city: "Phoenix", state: "NY", postalCode: "85004", countryCode: "US" });
    return { request: state.__ahaAfterpayRequest?.options, matching, mismatch };
  })).toMatchObject({
    request: { requestShippingContact: true, shippingContact: { addressLines: ["1 N Central Ave"], state: "NY", postalCode: "85004" }, total: { amount: "56.21" } },
    matching: { shippingOptions: [{ id: "quoted-shipping", amount: "0.00", taxLineItems: [{ amount: "4.21" }], total: { amount: "56.21" } }] },
    mismatch: { error: "Use the delivery address above, then confirm a fresh total if it needs to change." },
  });
});


test("checkout: Cash App return restores only the matching unexpired quote and reference ID", async ({ page }) => {
  let quotes = 0;
  await mockSquare(page, true);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: true } }) }));
  await page.route("**/api/checkout/quote", (route) => { quotes += 1; return route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeEnabled();
  const before = await page.evaluate(() => ({ resume: sessionStorage.getItem("aha-cash-app-resume-v1"), references: (window as Window & { __ahaCashReferences?: string[] }).__ahaCashReferences }));
  expect(before.references).toHaveLength(1);
  expect(before.resume).not.toContain("opaque-square-token");
  await page.reload();
  await expect(page.getByLabel("First name")).toHaveValue("Avery");
  await expect(page.locator("[data-quote-total]")).toHaveText("$56.21");
  await expect(page.locator("[data-checkout-message]")).toContainText("Secure payment options restored");
  const after = await page.evaluate(() => (window as Window & { __ahaCashReferences?: string[] }).__ahaCashReferences);
  expect(after).toHaveLength(1);
  expect(after?.[0]).toBe(before.references?.[0]);
  expect(quotes).toBe(1);
});

test("checkout: expired or bag-mismatched Cash App resume is discarded without re-quoting", async ({ page }) => {
  let quotes = 0;
  await mockSquare(page, true);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: true } }) }));
  await page.route("**/api/checkout/quote", (route) => { quotes += 1; return route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeEnabled();
  await page.evaluate(() => { const key = "aha-cash-app-resume-v1"; const saved = JSON.parse(sessionStorage.getItem(key)!); saved.quote.expiresAt = "2000-01-01T00:00:00.000Z"; sessionStorage.setItem(key, JSON.stringify(saved)); });
  await page.reload();
  // Checkout discards the expired resume after its catalog check, which is async.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("aha-cash-app-resume-v1"))).toBeNull();
  expect(quotes).toBe(1);
});


test("checkout: a bag-mismatched Cash App resume is discarded without re-quoting", async ({ page }) => {
  let quotes = 0;
  await mockSquare(page, true);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: true } }) }));
  await page.route("**/api/checkout/quote", (route) => { quotes += 1; return route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeEnabled();
  await page.evaluate(() => localStorage.setItem("aha-cart-v2", JSON.stringify([{ variationId: "R5UCZCGSJMR3Z4HJDVOD3ZIK", quantity: 2 }])));
  await page.reload();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("aha-cash-app-resume-v1"))).toBeNull();
  expect(quotes).toBe(1);
});

test("checkout: a gift card pays the whole server total, and a short balance says so plainly", async ({ page }) => {
  const paymentBodies: Record<string, unknown>[] = [];
  let decline = true;
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false, giftCard: true } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/checkout/pay", async (route) => {
    paymentBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (decline) { decline = false; await route.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: "payment_failed", errorCode: "payment_failed" }) }); return; }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ state: "completed", orderId: "AHA-1002", paymentId: "payment_gift" }) });
  });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await expect(page.locator("[data-gift-card]")).toBeHidden();
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await page.locator("[data-gift-card] summary").click();
  await page.getByRole("button", { name: "Pay with gift card" }).click();
  await expect(page.locator("[data-checkout-message]")).toContainText("That gift card couldn’t pay the full total.");
  await page.getByRole("button", { name: "Confirm total" }).click();
  await page.locator("[data-gift-card] summary").click();
  await page.getByRole("button", { name: "Pay with gift card" }).click();
  await expect(page.locator("[data-checkout-message]")).toContainText("Payment confirmed · order AHA-1002");
  expect(paymentBodies.map((body) => body.sourceId)).toEqual(["opaque-gift-card-token", "opaque-gift-card-token"]);
  expect(paymentBodies[1]).not.toHaveProperty("totalAmount");
});

test("checkout: the gift card option stays hidden when turned off", async ({ page }) => {
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false, giftCard: false } }) }));
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(quote) }));
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeEnabled();
  await expect(page.locator("[data-gift-card]")).toBeHidden();
});

test("checkout: flags the first missing delivery field and requires French fulfillment details before quoting", async ({ page }) => {
  const quoteBodies: Record<string, unknown>[] = [];
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ json: { appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: false, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } } }));
  await page.route("**/api/checkout/quote", async (route) => { quoteBodies.push(route.request().postDataJSON() as Record<string, unknown>); await route.fulfill({ json: quote }); });
  await page.goto("/checkout/?products=R5UCZCGSJMR3Z4HJDVOD3ZIK%3A1");
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.locator("[data-checkout-errors]")).toContainText("First name");
  await expect(page.getByLabel("First name")).toBeFocused();
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email").fill("avery@example.com");
  await page.getByLabel("Address").fill("10 Rue de Rivoli");
  await page.getByLabel("City").fill("Paris");
  await page.getByLabel("Country").selectOption("FR");
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.locator("[data-checkout-errors]")).toContainText("State, province or region, Postal code");
  await expect(page.getByLabel("State / province")).toBeFocused();
  expect(quoteBodies).toHaveLength(0);
  await page.getByLabel("State / province").fill("Île-de-France");
  await page.getByLabel("Postal code").fill("75001");
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect.poll(() => quoteBodies.length).toBe(1);
  expect((quoteBodies[0]!.shippingAddress as Record<string, unknown>).region).toBe("Île-de-France");
  expect((quoteBodies[0]!.shippingAddress as Record<string, unknown>).postalCode).toBe("75001");
});
