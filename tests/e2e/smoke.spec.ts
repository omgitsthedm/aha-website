import { test, expect } from "@playwright/test";

test("@product public site presents only the three-hoodie pilot", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/^After Hours Agenda$/i);
  await expect(page.getByRole("heading", { level: 1, name: "After Hours Agenda" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "The first three" })).toBeVisible();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#fafafa");
  if (testInfo.project.name === "chromium") {
    await expect(page.locator("html")).toHaveCSS("background-color", "rgb(250, 250, 250)");
    await expect(page.getByRole("heading", { level: 1 }).locator("span")).toHaveCSS("color", "rgb(255, 107, 107)");
    await expect(page.getByRole("button", { name: "Open bag" })).toHaveCSS("background-color", "rgb(255, 107, 107)");
  }
  await expect(page.getByRole("link", { name: /Branded Unisex Hoodie/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Classic - Black Unisex Hoodie/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Colors Unisex Hoodie/i })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/design files|drops|collections/i);
});

test("@product pilot shop and product routes are live", async ({ page }, testInfo) => {
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 1, name: "Three hoodies" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Branded Unisex Hoodie/i })).toBeVisible();
  await page.goto("/product/branded-unisex-hoodie");
  await expect(page).toHaveURL(/\/product\/branded-unisex-hoodie/);
  await expect(page.getByRole("heading", { level: 1, name: "Branded Unisex Hoodie" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const addToBag = page.getByRole("button", { name: /Add to bag/i });
  await expect(addToBag).toBeEnabled();
  if (testInfo.project.name === "mobile") return;
  await addToBag.click();
  await expect(page.getByRole("heading", { name: "Added to bag" })).toBeVisible();
});

test("@product non-pilot storefront routes return to the pilot home", async ({ page }) => {
  const routes = [
    "/new-arrivals",
    "/catalog-edit",
    "/collections/no-kings",
    "/drops",
    "/drops/current",
    "/lookbook",
    "/lookbook/design-files",
    "/coming-soon",
    "/newsletter",
    "/restock",
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
