import { test, expect, type Page } from "./fixtures";

// The storewide sale (src/data/sale.json). Each test sets the browser's date, so
// these hold whenever they run. Square and every checkout endpoint are stubbed.
const DURING = new Date("2026-11-28T18:00:00Z");
const AFTER = new Date("2026-12-02T10:00:01Z");
const crewM = "R5UCZCGSJMR3Z4HJDVOD3ZIK";
const config = { appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: true, googlePay: true, afterpay: false, cashAppPay: false } };
// What the server quotes for one $52 crewneck to Arizona during the sale.
const saleQuote = { checkoutId: "checkout_sale_1", checkoutToken: "safe-checkout-token", expiresAt: "2030-01-01T00:00:00.000Z", currency: "USD", lineItems: [{ variationId: crewM, quantity: 1, unitAmount: 5200, totalAmount: 5200 }], subtotalAmount: 5200, discountAmount: 1300, discountLabel: "25% off all clothing", shippingAmount: 0, taxAmount: 316, totalAmount: 4216, taxLabel: "Arizona TPT (Peoria 8.1%)", shippingLabel: "Free U.S. shipping", shippingRegion: "AZ" };
type Wallet = Window & { __requests?: unknown[]; __updates?: unknown[]; __address?: (contact: unknown) => Promise<unknown>; __purchases?: unknown[] };

async function mockSquare(page: Page) {
  await page.addInitScript(() => {
    const state = window as Wallet;
    state.__updates = [];
    state.__requests = [];
    state.__purchases = [];
    document.addEventListener("aha:purchase-confirmed", (event) => state.__purchases!.push((event as CustomEvent).detail));
    window.Square = { payments: () => ({
      card: async () => ({ attach: async () => {}, tokenize: async () => ({ status: "OK", token: "opaque-card-token" }) }),
      paymentRequest: (request: unknown) => {
        state.__requests!.push(request);
        return { addEventListener: (name: string, listener: (contact: unknown) => Promise<unknown>) => { if (name === "shippingcontactchanged") state.__address = listener; }, update: (value: unknown) => { state.__updates!.push(value); return true; } };
      },
      applePay: async () => { throw new Error("Apple Pay is not available"); },
      googlePay: async () => ({ attach: async (target: string) => { const button = document.createElement("button"); button.type = "button"; button.textContent = "Buy with GPay"; document.querySelector(target)!.append(button); }, tokenize: async () => ({ status: "OK", token: "opaque-wallet-token" }) }),
    }) } as unknown as Window["Square"];
  });
}
async function fillAddress(page: Page) {
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email").fill("avery@example.com");
  await page.getByLabel("Address").fill("1 N Central Ave");
  await page.getByLabel("City").fill("Phoenix");
  await page.getByLabel("State / province").fill("AZ");
  await page.getByLabel("Postal code").fill("85004");
}

test("sale: code is sent at checkout, and the confirmed order includes the discount", async ({ page }) => {
  await page.clock.setFixedTime(DURING);
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ json: { ...config, methods: { ...config.methods, applePay: false, googlePay: false } } }));
  await page.route("**/api/checkout/quote", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ discountCode: "SHOPSMALL25" });
    return route.fulfill({ json: saleQuote });
  });
  await page.route("**/api/checkout/pay", (route) => route.fulfill({ json: { state: "completed", orderId: "AHA-2001", paymentId: "payment_sale", orderNumber: "AHA-2001", receiptEmail: "avery@example.com" } }));

  await page.goto("/shop/yikes-crewneck/");
  const sale = page.locator(".benefit-bar .benefit-sale");
  await expect(sale).toHaveText("25% off · code SHOPSMALL25");
  await expect(sale).toHaveAttribute("href", "/shop/");
  await expect(page.locator(".benefit-bar")).not.toContainText("Made to order");
  // The listed price stays the regular one (feeds and structured data carry it); the bag shows the sale.
  await expect(page.locator(".product-price-row .product-price")).toHaveText("$52 USD");

  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.getByRole("button", { name: "Add to bag" }).click();
  const card = page.locator(".bag-panel");
  await expect(card.locator(".bag-panel-total span")).toHaveText("Bag subtotal · 1 item");
  await expect(card.locator(".bag-panel-total strong")).toHaveText("$52.00");

  await page.goto("/checkout/");
  await expect(page.locator("[data-cart-subtotal]")).toHaveText("$52.00");
  await page.getByRole("textbox", { name: /discount code/i }).fill("SHOPSMALL25");

  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  const summary = page.locator("[data-checkout-summary]");
  await expect(summary).toBeVisible();
  await expect(summary.locator("[data-quote-subtotal]")).toHaveText("$52.00");
  const discount = summary.locator("[data-quote-discount-row]");
  await expect(discount).toBeVisible();
  await expect(discount.locator("span")).toHaveText("25% off all clothing");
  await expect(discount.locator("strong")).toHaveText("−$13.00");
  await expect(summary.locator("[data-quote-tax]")).toHaveText("$3.16");
  await expect(summary.locator("[data-quote-total]")).toHaveText("$42.16");

  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page.locator("[data-checkout-message]")).toContainText("Payment confirmed · order AHA-2001");
  // The purchase is reported at what was paid for the goods.
  expect(await page.evaluate(() => (window as Wallet).__purchases)).toEqual([{ orderId: "AHA-2001", value: 39, shipping: 0, tax: 3.16, currency: "USD", items: [{ id: crewM, name: "Yikes! Crewneck — Bone", price: 39, quantity: 1 }] }]);
  await expect(summary).toBeHidden();
});

test("sale: a total without a discount shows no sale row, even while the sale is advertised", async ({ page }) => {
  await page.clock.setFixedTime(DURING);
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ json: { ...config, methods: { ...config.methods, applePay: false, googlePay: false } } }));
  const { discountAmount: _amount, discountLabel: _label, ...regular } = saleQuote;
  await page.route("**/api/checkout/quote", (route) => route.fulfill({ json: { ...regular, taxAmount: 421, totalAmount: 5621 } }));
  await page.goto(`/checkout/?products=${crewM}%3A1`);
  await fillAddress(page);
  await page.getByRole("button", { name: "Confirm total" }).click();
  const summary = page.locator("[data-checkout-summary]");
  await expect(summary.locator("[data-quote-total]")).toHaveText("$56.21");
  await expect(summary.locator("[data-quote-discount-row]")).toBeHidden();
});

test("sale: once it ends, nothing on the site mentions it", async ({ page }) => {
  await page.clock.setFixedTime(AFTER);
  await page.goto("/shop/yikes-crewneck/");
  await expect(page.locator(".benefit-bar")).toContainText("Made to order. Made to keep.");
  await expect(page.locator(".benefit-bar .benefit-sale")).toHaveCount(0);
  await expect(page.locator(".product-price-row .product-price")).toHaveText("$52 USD");
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.locator(".bag-panel .bag-panel-total span")).toHaveText("Bag subtotal · 1 item");
  await expect(page.locator(".bag-panel .bag-panel-total strong")).toHaveText("$52.00");
  await page.goto("/checkout/");
  await expect(page.locator("[data-cart-subtotal]")).toHaveText("$52.00");
  await expect(page.getByRole("textbox", { name: /discount code/i })).toHaveValue("");
});

test("sale: the wallet in checkout receives the confirmed code-adjusted total", async ({ page }) => {
  await page.clock.setFixedTime(DURING);
  await mockSquare(page);
  await page.route("**/api/checkout/config", (route) => route.fulfill({ json: config }));
  await page.route("**/api/checkout/quote", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ discountCode: "SHOPSMALL25" });
    return route.fulfill({ json: saleQuote });
  });
  await page.goto(`/checkout/?products=${crewM}%3A1`);
  await fillAddress(page);
  await page.getByRole("textbox", { name: /discount code/i }).fill("SHOPSMALL25");
  await page.getByRole("button", { name: "Confirm total" }).click();
  await expect(page.locator("#aha-google-pay").getByRole("button", { name: "Buy with GPay" })).toBeVisible();
  await expect(page.locator("[data-quote-total]")).toHaveText("$42.16");
  expect(await page.evaluate(() => (window as Wallet).__requests?.at(-1))).toMatchObject({ total: { amount: "42.16" } });
  await page.getByRole("textbox", { name: /discount code/i }).fill("different");
  await expect(page.locator("[data-checkout-summary]")).toBeHidden();
  await expect(page.getByRole("button", { name: "Pay securely" })).toBeDisabled();
});
test("sale: on a phone the header shows the sale on one line and the page is no wider or taller for it", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const measure = async () => page.evaluate(() => ({ bar: document.querySelector(".benefit-bar")!.getBoundingClientRect().height, header: document.querySelector("[data-header-bar]")!.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, shown: [...document.querySelectorAll<HTMLElement>(".benefit-bar > *")].filter((node) => node.getClientRects().length).map((node) => node.textContent) }));
  await page.clock.setFixedTime(AFTER);
  await page.goto("/shop/");
  const regular = await measure();
  expect(regular.shown).toEqual(["Free U.S. shipping"]);
  await page.clock.setFixedTime(DURING);
  await page.goto("/shop/");
  await expect(page.locator(".benefit-bar .benefit-sale")).toBeVisible();
  const during = await measure();
  expect(during.shown).toEqual(["25% off · code SHOPSMALL25"]);
  expect([during.bar, during.header, during.overflow]).toEqual([regular.bar, regular.header, regular.overflow]);
  expect(during.overflow).toBe(0);
});
