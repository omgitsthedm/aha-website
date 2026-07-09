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
