import { test, expect } from "@playwright/test";

// @product — homepage + shop smoke. Cart/checkout specs (@cart/@checkout) land in Phase 2-3.
test("@product homepage renders AHA brand and a shop path", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/After Hours Agenda/i);
  // A route to browse product must be reachable from home.
  const shopLink = page.getByRole("link", { name: /shop|new arrivals|drops/i }).first();
  await expect(shopLink).toBeVisible();
});

test("@product shop page loads", async ({ page }) => {
  const res = await page.goto("/shop");
  expect(res?.status()).toBeLessThan(400);
});

test("@content relaunch routes render complete customer paths", async ({ page }) => {
  const routes = [
    ["/drops", /Products arrive when the work is ready/i],
    ["/drops/current", /Current release|No separate release/i],
    ["/drops/archive", /Release archive/i],
    ["/coming-soon", /When it is ready/i],
    ["/lookbook", /Design issues/i],
    ["/lookbook/design-files", /Design files/i],
    ["/newsletter", /The useful email/i],
    ["/restock?product=Social%20Club&size=XL", /Ask for the one/i],
  ] as const;

  for (const [route, heading] of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1, name: heading }), route).toBeVisible();
  }

  await expect(page.getByLabel("Product name")).toHaveValue("Social Club");
  await expect(page.getByLabel("Size or variant")).toHaveValue("XL");
});

test("@catalog shop pagination is crawlable and bounded", async ({ page }) => {
  const response = await page.goto("/shop?page=2");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/Page 2.*After Hours Agenda/i);
  await expect(page.locator('a[href^="/product/"]')).toHaveCount(24);
  await expect(page.getByRole("navigation", { name: "Catalog pages" })).toBeVisible();
  await expect(page.getByRole("link", { name: "2", exact: true })).toHaveAttribute("aria-current", "page");
});

test("@security checkout ships an enforced Square-compatible CSP", async ({ page }) => {
  const response = await page.goto("/checkout");
  const csp = response?.headers()["content-security-policy"] || "";
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("https://web.squarecdn.com");
  expect(csp).toContain("https://sandbox.web.squarecdn.com");
  expect(csp).toContain("https://pci-connect.squareup.com");
});

test("@operations customer order tracking fails closed without a match", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Provider-backed operation is browser-independent and covered in Chromium.");
  await page.goto("/track-order");
  await expect(page).toHaveTitle(/Track Your Order/i);
  await page.getByLabel("Order number").fill("AHA-NOT-A-REAL-ORDER");
  await page.getByLabel("Checkout email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Check order status" }).click();
  await expect(page.locator("p[role='alert']")).toContainText(/No matching order|temporarily unavailable/, { timeout: 10_000 });
});

test("@operations private commerce dashboard requires sign in", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Server-side auth redirect is browser-independent and covered in Chromium.");
  await page.goto("/ops");
  await expect(page).toHaveURL(/\/ops\/login/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
