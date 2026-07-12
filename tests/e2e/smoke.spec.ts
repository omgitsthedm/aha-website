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
