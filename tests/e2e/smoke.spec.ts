import { test, expect } from "@playwright/test";

test("@product public site is a zero-content brand hold", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/^After Hours Agenda$/i);
  await expect(page.getByRole("heading", { level: 1, name: "After Hours Agenda" })).toBeVisible();
  await expect(page.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/shop|collection|design files|drops|releases/i);
});

test("@product legacy storefront routes return to the brand hold", async ({ page }) => {
  const routes = [
    "/shop",
    "/new-arrivals",
    "/catalog-edit",
    "/product/social-club",
    "/collections/no-kings",
    "/drops",
    "/drops/current",
    "/lookbook",
    "/lookbook/design-files",
    "/coming-soon",
    "/newsletter",
    "/restock",
    "/cart",
    "/checkout",
    "/about",
    "/product-feed.xml",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page, route).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "After Hours Agenda" }),
      route,
    ).toBeVisible();
  }
});

test("@security holding page keeps the production security policy", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] || "";
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("https://web.squarecdn.com");
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
