import { test as base, expect, type Page } from "@playwright/test";
import { orderStatusUrl } from "../../server/orders/status.mjs";
import { LOCAL_ORDER_SECRET, LOCAL_SHIPPED_ORDER } from "../../scripts/local-accounts.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
async function axe(page: Page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => (await (window as unknown as { axe: { run: (options: unknown) => Promise<{ violations: Array<{ id: string }> }> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map((violation) => violation.id));
}

// Passkeys need a real hostname, so these pages open on localhost. The local
// server runs the real account and review handlers on an in-memory database
// (scripts/local-accounts.mjs); Chrome's virtual authenticator stands in for
// the device that keeps the passkey.
const LOCAL = (process.env.BASE_URL || "http://127.0.0.1:48379").replace("127.0.0.1", "localhost");

// The shared fixture's network boundary, with localhost as the one site: no
// request leaves for analytics, payment or email services.
const test = base.extend<{ boundary: void }>({
  boundary: [async ({ context }, use) => {
    const site = new URL(LOCAL).origin;
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === site) return route.continue();
      if (["www.googletagmanager.com", "connect.facebook.net", "us-assets.i.posthog.com"].includes(url.hostname)) return route.fulfill({ status: 200, contentType: "application/javascript", body: "/* Local test stub. */" });
      return ["http:", "https:"].includes(url.protocol) ? route.abort("blockedbyclient") : route.continue();
    });
    await use();
  }, { auto: true }],
});

async function authenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
}

test.skip(Boolean(process.env.BASE_URL), "accounts are checked against the local handlers");

test("a passkey account saves pieces, signs out and back in, and deletes itself", async ({ page }) => {
  await authenticator(page);
  await page.goto(`${LOCAL}/shop/yikes-crewneck/`);
  const save = page.getByRole("button", { name: "Save for later" });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-cart-add-status]")).toContainText("Saved.");

  await page.goto(`${LOCAL}/account/`);
  await expect(page.locator("[data-saved-card='yikes-crewneck']")).toBeVisible();
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByText("You’re signed in on this device.")).toBeVisible();
  await expect(page.locator("[data-account-orders]")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("aha-account-v1"))).toBe("1");

  // A second piece saved while signed in reaches the account.
  const second = "mighty-micks-ss3000-navy";
  await page.goto(`${LOCAL}/shop/${second}/`);
  await page.getByRole("button", { name: "Save for later" }).click();
  await expect.poll(() => page.evaluate(() => fetch("/api/account/me").then((r) => r.json()).then((d) => d.saved))).toEqual([second, "yikes-crewneck"]);

  // Sign out, forget this browser's list, sign back in: the account brings it back.
  await page.goto(`${LOCAL}/account/`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("aha-saved-v1"));
  await page.reload();
  await expect(page.locator("[data-saved-empty]")).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("You’re signed in on this device.")).toBeVisible();
  await expect(page.locator(`[data-saved-card='${second}']`)).toBeVisible();
  await expect(page.locator("[data-saved-card='yikes-crewneck']")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("button", { name: "Create an account" })).toBeVisible();
  expect(await page.evaluate(() => fetch("/api/account/me").then((r) => r.json()))).toEqual({ signedIn: false });
  // The deleted passkey no longer signs in.
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-account-status]")).toContainText("isn't linked to an account");
});

test("the order page adds the order to the account and takes a review", async ({ page }) => {
  await authenticator(page);
  const link = orderStatusUrl(LOCAL_SHIPPED_ORDER, { get: (key: string) => (key === "AHA_ORDER_LINK_SECRET" ? LOCAL_ORDER_SECRET : undefined) }, LOCAL)!;
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Order LOCAL-1" })).toBeVisible();
  await page.getByRole("button", { name: "Add to my account" }).click();
  await expect(page.locator("[data-order-keep-status]")).toContainText("Sign in first");

  await page.goto(`${LOCAL}/account/`);
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByText("You’re signed in on this device.")).toBeVisible();
  await page.goto(link);
  await page.getByRole("button", { name: "Add to my account" }).click();
  await expect(page.locator("[data-order-keep-status]")).toHaveText("Added to your account.");
  await page.goto(`${LOCAL}/account/`);
  await expect(page.locator("[data-orders-list]")).toContainText("Order LOCAL-1 Shipped");

  await page.goto(link);
  const form = page.locator(".review-form").first();
  await expect(form.getByRole("heading")).toContainText("Yikes!");
  await form.getByRole("button", { name: "Send review" }).click();
  await expect(form.locator(".review-status")).toHaveText("Choose a rating and write a few words.");
  await form.getByText("5 stars").click();
  await form.getByLabel("Your review").fill("Heavy, soft and the print is sharp.");
  await form.getByLabel("Name to show (optional)").fill("Sam");
  await form.getByRole("button", { name: "Send review" }).click();
  await expect(form.locator(".review-status")).toHaveText("Thanks. Your review appears once we’ve read it.");
  expect(await axe(page)).toEqual([]);
  // Waiting for approval: the product page shows no reviews yet.
  await page.goto(`${LOCAL}/shop/yikes-crewneck/`);
  await expect(page.locator("[data-reviews]")).toBeHidden();
});

test("the account page is accessible and works signed out", async ({ page }) => {
  await page.goto(`${LOCAL}/account/`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your pieces, in one place.");
  await expect(page.locator("[data-account-orders]")).toBeHidden();
  await expect(page.locator("[data-saved-empty]")).toBeVisible();
  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  expect(await axe(page)).toEqual([]);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a product page shows approved reviews, and none when there are none", async ({ page }) => {
  await page.route("**/api/reviews?product=yikes-crewneck", (route) => route.fulfill({ json: { count: 2, average: 4.5, reviews: [{ rating: 5, body: "Heavy and soft.", name: "Sam", date: "2026-11-02" }, { rating: 4, body: "Print is sharp.", name: null, date: "2026-10-30" }] } }));
  await page.goto(`${LOCAL}/shop/yikes-crewneck/`);
  const reviews = page.locator("#reviews");
  await expect(reviews).toBeVisible();
  await expect(reviews.locator("[data-review-summary]")).toHaveText("4.5 out of 5 · 2 reviews");
  await expect(reviews.locator("li").first()).toContainText("Heavy and soft.");
  await expect(reviews.locator("li").nth(1)).toContainText("Verified buyer");
  await expect(reviews.getByLabel("5 out of 5")).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.goto(`${LOCAL}/shop/yikes-cropped-hoodie/`);
  await expect(page.locator("#reviews")).toBeHidden();
});

test("a drop in early access asks shoppers to sign in before buying", async ({ page }) => {
  const early = new Date(Date.now() - 3600_000).toISOString(), release = new Date(Date.now() + 86400_000).toISOString();
  await page.route("**/shop/yikes-crewneck/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace('<div class="arrival" data-arrival>', `<p class="drop-note" data-drop data-early="${early}" data-release="${release}">Account holders can buy it now.</p><div class="arrival" data-arrival>`);
    await route.fulfill({ response, body: html });
  });
  await page.goto(`${LOCAL}/shop/yikes-crewneck/`);
  await expect(page.getByRole("link", { name: "Sign in for early access" })).toHaveAttribute("href", "/account/");
  await expect(page.getByRole("button", { name: /Add to bag/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Buy now/ })).toBeDisabled();
});

test("saved pieces include products published live and leave out ones removed from sale", async ({ page }) => {
  const card = '<article class="product-card"><a class="product-card-image" href="/shop/live-piece/" aria-label="Shop Live Piece in Ink"><img src="/images/mighty-micks/mighty-micks-ss3000-navy/garment-front-400.webp" alt="Live Piece" width="400" height="500"></a><div class="product-card-info"><div><h2><a href="/shop/live-piece/">Live Piece</a></h2><p>Ink · S–XL</p></div><p class="product-price">$50</p></div></article>';
  await page.route("**/api/catalog/live", (route) => route.fulfill({ json: { known: true, products: [{ slug: "live-piece", collection: "New", card }], cartLines: [], retired: ["pet-it-be-ss3000-maroon"], retiredVariations: [] } }));
  await page.addInitScript(() => localStorage.setItem("aha-saved-v1", JSON.stringify(["live-piece", "pet-it-be-ss3000-maroon", "yikes-crewneck"])));
  await page.goto(`${LOCAL}/account/`);
  await expect(page.locator("[data-saved-card='live-piece']")).toBeVisible();
  await expect(page.locator("[data-saved-card='live-piece'] h2")).toHaveText("Live Piece");
  await expect(page.locator("[data-saved-card='yikes-crewneck']")).toBeVisible();
  await expect(page.locator("[data-saved-card='pet-it-be-ss3000-maroon']")).toBeHidden();
  await expect(page.locator("[data-saved-empty]")).toBeHidden();
});
