import { test, expect, type Page } from "./fixtures";

// Apple Pay and Google Pay on product pages. Square is mocked: the wallet sheet's
// address event is called directly, and tokenize returns what Square documents
// (a token plus the approved shipping contact). No request leaves the machine.
const crewM = "R5UCZCGSJMR3Z4HJDVOD3ZIK";
const contact = { givenName: "Avery", familyName: "Tester", email: "avery@example.com", phone: "+16025550100", addressLines: ["1 N Central Ave", "Apt 2"], city: "Phoenix", state: "AZ", postalCode: "85004", countryCode: "US" };
const quote = { checkoutId: "checkout_express_1", checkoutToken: "safe-checkout-token", expiresAt: "2030-01-01T00:00:00.000Z", currency: "USD", lineItems: [{ variationId: crewM, quantity: 1, unitAmount: 5200, totalAmount: 5200 }], subtotalAmount: 5200, shippingAmount: 0, taxAmount: 421, totalAmount: 5621, taxLabel: "Arizona TPT (Peoria 8.1%)", shippingLabel: "Free U.S. shipping", shippingRegion: "AZ" };
const estimate = { currency: "USD", subtotalAmount: 5200, shippingAmount: 0, taxAmount: 421, totalAmount: 5621, taxLabel: "Arizona TPT (Peoria 8.1%)", shippingLabel: "Free U.S. shipping" };
type Wallet = Window & { __request?: { requestShippingContact?: boolean; total?: { amount: string; pending?: boolean }; lineItems?: unknown[] }; __updates?: unknown[]; __address?: (contact: unknown) => Promise<unknown> };

async function mockSquare(page: Page) {
  await page.addInitScript((approved) => {
    const state = window as Wallet;
    state.__updates = [];
    window.Square = { payments: () => ({
      card: async () => ({ tokenize: async () => ({ status: "OK" }) }),
      paymentRequest: (request: unknown) => {
        state.__request = request as Wallet["__request"];
        return { addEventListener: (name: string, listener: (contact: unknown) => Promise<unknown>) => { if (name === "shippingcontactchanged") state.__address = listener; }, update: (value: unknown) => { state.__updates!.push(value); return true; } };
      },
      // Chrome has no Apple Pay; Square rejects it there.
      applePay: async () => { throw new Error("Apple Pay is not available"); },
      googlePay: async () => ({
        attach: async (target: string) => { const button = document.createElement("button"); button.type = "button"; button.textContent = "Buy with GPay"; document.querySelector(target)!.append(button); },
        tokenize: async () => ({ status: "OK", token: "opaque-wallet-token", details: { method: "Google Pay", shipping: { contact: approved } } }),
      }),
    }) } as unknown as Window["Square"];
  }, contact);
}
async function routes(page: Page, { estimateTotal = 5621 } = {}) {
  const calls: Record<string, Record<string, unknown>[]> = { config: [], estimate: [], quote: [], pay: [] };
  await page.route("**/api/checkout/config", (route) => { calls.config!.push({}); return route.fulfill({ json: { appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: true, googlePay: true, afterpay: false, cashAppPay: false } } }); });
  await page.route("**/api/checkout/estimate", (route) => { calls.estimate!.push(route.request().postDataJSON()); return route.fulfill({ json: { ...estimate, totalAmount: estimateTotal, taxAmount: estimateTotal - 5200 } }); });
  await page.route("**/api/checkout/quote", (route) => { calls.quote!.push(route.request().postDataJSON()); return route.fulfill({ json: quote }); });
  await page.route("**/api/checkout/pay", (route) => { calls.pay!.push(route.request().postDataJSON()); return route.fulfill({ json: { state: "completed", orderId: "AHA-1001", paymentId: "payment_test" } }); });
  return calls;
}

test("Google Pay on a product page prices the wallet address, then quotes and pays, leaving the bag alone", async ({ page }) => {
  await mockSquare(page);
  const calls = await routes(page);
  await page.addInitScript(() => localStorage.setItem("aha-cart-v2", JSON.stringify([{ variationId: "4HDYVGQA3ZOGIPYFUCTPKPIV", quantity: 1 }])));
  await page.goto("/shop/yikes-crewneck/");
  const express = page.locator("[data-express]");
  await expect(express).toBeHidden();
  await page.waitForTimeout(300);
  expect(calls.config, "nothing loads before a size is chosen").toHaveLength(0);

  await page.getByRole("radio", { name: "M", exact: true }).check();
  await expect(express).toBeVisible();
  await expect(express.getByRole("button", { name: "Buy with GPay" })).toBeVisible();
  await expect(page.locator("[data-express-apple]")).toBeHidden();
  expect(await page.evaluate(() => (window as Wallet).__request)).toMatchObject({ requestShippingContact: true, total: { amount: "52.00", pending: true } });

  // The sheet shows the address's real total, priced by the server.
  const update = await page.evaluate(() => (window as Wallet).__address!({ city: "Phoenix", state: "AZ", postalCode: "85004", countryCode: "US" }));
  expect(update).toMatchObject({ total: { amount: "56.21", pending: false }, lineItems: [{ amount: "52.00" }, { label: "Free U.S. shipping", amount: "0.00" }, { label: "Arizona TPT (Peoria 8.1%)", amount: "4.21" }] });
  expect(calls.estimate![0]).toEqual({ items: [{ variationId: crewM, quantity: 1 }], destination: { country: "US", region: "AZ", postalCode: "85004", city: "Phoenix" } });

  await express.getByRole("button", { name: "Buy with GPay" }).click();
  await expect(page.locator("[data-express-status]")).toContainText("Payment confirmed · order AHA-1001");
  expect(calls.quote![0]).toMatchObject({ items: [{ variationId: crewM, quantity: 1 }], shippingAddress: { firstName: "Avery", lastName: "Tester", email: "avery@example.com", addressLine1: "1 N Central Ave", addressLine2: "Apt 2", city: "Phoenix", region: "AZ", postalCode: "85004", country: "US" } });
  expect(calls.pay![0]).toMatchObject({ checkoutId: "checkout_express_1", checkoutToken: "safe-checkout-token", sourceId: "opaque-wallet-token" });
  expect(String(calls.pay![0]!.idempotencyKey)).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
  // The other piece in the bag stays there.
  expect(await page.evaluate(() => localStorage.getItem("aha-cart-v2"))).toBe(JSON.stringify([{ variationId: "4HDYVGQA3ZOGIPYFUCTPKPIV", quantity: 1 }]));
  await expect(express.getByRole("button", { name: "Buy with GPay" })).toHaveCount(0);
});

test("a wallet payment is never charged at a total the shopper didn't see", async ({ page }) => {
  await mockSquare(page);
  // The sheet showed $52.00 (no tax); the quote for the approved address says $56.21.
  const calls = await routes(page, { estimateTotal: 5200 });
  await page.goto("/shop/yikes-crewneck/");
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await expect(page.getByRole("button", { name: "Buy with GPay" })).toBeVisible();
  await page.evaluate(() => (window as Wallet).__address!({ state: "NY", postalCode: "10001", countryCode: "US" }));
  await page.getByRole("button", { name: "Buy with GPay" }).click();
  await expect(page.locator("[data-express-status]")).toHaveText("The total for that address is $56.21; tap to pay again. Nothing was charged.");
  expect(calls.pay).toHaveLength(0);
  // A size change resets the sheet to pending.
  await page.getByRole("radio", { name: "L", exact: true }).check();
  await expect.poll(() => page.evaluate(() => (window as Wallet).__updates!.at(-1))).toMatchObject({ total: { pending: true } });
});

test("wallets stay off where nothing can be bought this way", async ({ page }) => {
  await mockSquare(page);
  const calls = await routes(page);
  // An unknown destination comes back as an error the wallet shows.
  await page.goto("/shop/yikes-crewneck/");
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await expect(page.getByRole("button", { name: "Buy with GPay" })).toBeVisible();
  await page.route("**/api/checkout/estimate", (route) => route.fulfill({ status: 422, json: { error: "unsupported_destination", errorCode: "unsupported_destination" } }));
  expect(await page.evaluate(() => (window as Wallet).__address!({ countryCode: "BR" }))).toEqual({ error: "We don’t ship to this country yet." });
  // A piece off sale never offers them.
  await page.goto("/shop/pet-it-be-ss3000-maroon/");
  await expect(page.locator("[data-express]")).toHaveCount(0);
  const before = calls.config!.length;
  await page.waitForTimeout(300);
  expect(calls.config!.length).toBe(before);
  // With wallets turned off in the checkout settings, the box stays hidden.
  await page.unroute("**/api/checkout/config");
  await page.route("**/api/checkout/config", (route) => route.fulfill({ json: { appId: "public-app", locationId: "location", countryCode: "US", currencyCode: "USD", methods: { card: true, applePay: false, googlePay: false, afterpay: false, cashAppPay: false } } }));
  await page.goto("/shop/the-city-ss3000-black/");
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.waitForTimeout(300);
  await expect(page.locator("[data-express]")).toBeHidden();
});
