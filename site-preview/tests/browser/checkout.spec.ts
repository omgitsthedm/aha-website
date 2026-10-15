import { test, expect } from "@playwright/test";

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
    const state = window as Window & { __ahaPaymentRequest?: unknown; __ahaCashReferences?: string[] };
    state.__ahaCashReferences = [];
    window.Square = { payments: () => ({
      card: async () => ({ attach: async () => {}, tokenize: async () => ({ status: "OK", token: "opaque-square-token" }) }),
      paymentRequest: (request: unknown) => { state.__ahaPaymentRequest = request; return {}; },
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
  expect(quoteBodies).toEqual([{ items: [{ variationId: "R5UCZCGSJMR3Z4HJDVOD3ZIK", quantity: 1 }], shippingAddress: { firstName: "Avery", lastName: "Tester", email: "avery@example.com", addressLine1: "1 N Central Ave", city: "Phoenix", region: "AZ", postalCode: "85004", country: "US" } }]);
  expect(paymentBodies).toHaveLength(1);
  expect(paymentBodies[0]).toMatchObject({ checkoutId: "checkout_test_1", checkoutToken: "safe-checkout-token", sourceId: "opaque-square-token" });
  expect(paymentBodies[0]).not.toHaveProperty("totalAmount");
  expect(paymentBodies[0]).not.toHaveProperty("price");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("opaque-square-token");
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
  expect(await page.evaluate(() => sessionStorage.getItem("aha-cash-app-resume-v1"))).toBeNull();
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
  expect(await page.evaluate(() => sessionStorage.getItem("aha-cash-app-resume-v1"))).toBeNull();
  expect(quotes).toBe(1);
});
