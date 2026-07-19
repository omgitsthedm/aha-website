import { test, expect } from "@playwright/test";

// Smoke pack for the current full-catalog storefront (the earlier three-hoodie
// "pilot" era is retired). Runs against a local production build in preview-
// catalog mode (see e2e.yml). Protects the browse -> product -> add-to-bag ->
// checkout-entry path plus the security/ops gates.

test("@product home renders the brand hero and primary shopping CTAs", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/After Hours Agenda \| Independent NYC Streetwear/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("After Hours");
  // Rose browser chrome: light theme-color is the brand rose fill.
  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute("content", "#FF6B6B");
  await expect(page.getByRole("link", { name: "Shop Men", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop Women", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open bag" })).toBeVisible();
});

test("@catalog shop lists products and links to PDPs", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/catalog/i);
  const firstProduct = page.locator('a[href^="/product/"]').first();
  await expect(firstProduct).toBeVisible();
});

test("@product PDP shows price and a working Add to bag", async ({ page }, testInfo) => {
  await page.goto("/product/dont-fuck-fascists-shirt");
  await expect(page).toHaveURL(/\/product\/dont-fuck-fascists-shirt/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("domcontentloaded");
  const addToBag = page.getByRole("button", { name: /Add to bag/i }).first();
  await expect(addToBag).toBeVisible();
  // The mobile project verifies the CTA is reachable; the click flow runs on
  // chromium to keep the pack fast and deterministic.
  if (testInfo.project.name === "mobile") {
    const box = await addToBag.boundingBox();
    expect(box).not.toBeNull();
    return;
  }
  await expect(addToBag).toBeEnabled();
  await addToBag.click();
  await expect(page.getByRole("heading", { name: "Added to bag" })).toBeVisible();
});

test("@product a tap on the sticky mobile buy CTA reaches the buy button, not feedback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The sticky buy bar and overlap only exist at mobile widths.");
  // Pre-set the cookie-consent choice so its bottom banner (z-400) isn't shown
  // (a returning user has already chosen). That isolates the thing under test:
  // the only element that could cover the sticky buy CTA is the feedback launcher.
  await page.addInitScript(() => window.localStorage.setItem("aha-cookie-consent", "granted"));
  await page.goto("/product/dont-fuck-fascists-shirt");
  await page.waitForLoadState("domcontentloaded");
  // Hit-test the CTA inside the sticky buy bar (fixed to the viewport bottom).
  // Whatever sits at its center must be that button, never the feedback launcher.
  const stickyBar = page.getByTestId("sticky-buy-bar");
  const stickyButton = stickyBar.locator("button").first();
  await expect(stickyButton).toBeInViewport();
  const result = await stickyButton.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { insideButton: !!hit && (hit === el || el.contains(hit)), hitLabel: hit?.closest("[aria-label]")?.getAttribute("aria-label") ?? null };
  });
  expect(result.insideButton, `tap landed on ${result.hitLabel ?? "an element outside the buy button"}`).toBe(true);
});

test("@catalog cart page renders its empty state", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).toContainText(/bag|cart/i);
});

test("@operations order tracking fails closed without a match", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Provider-backed operation is browser-independent and covered in Chromium.");
  await page.goto("/track-order");
  await expect(page).toHaveTitle(/Track/i);
  await page.getByLabel("Order number").fill("AHA-NOT-A-REAL-ORDER");
  await page.getByLabel("Checkout email").fill("nobody@example.com");
  await page.getByRole("button", { name: /Check order status/i }).click();
  await expect(page.locator("p[role='alert']")).toContainText(/No matching order|temporarily unavailable/, { timeout: 10_000 });
});

test("@security the production CSP is present on the document", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] || "";
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("https://web.squarecdn.com");
});

test("@operations the ops sign-in surface renders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Auth surface is browser-independent and covered in Chromium.");
  // The production redirect gate (unauthenticated /ops -> /ops/login) depends on
  // production ops secrets and is unit-tested (ops-auth). Here we just confirm
  // the sign-in front door renders in the build.
  await page.goto("/ops/login");
  await expect(page.getByRole("heading", { level: 1, name: /sign in/i })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("@catalog retired routes redirect home", async ({ page }) => {
  for (const route of ["/drops", "/collections/no-kings", "/coming-soon", "/catalog-edit"]) {
    await page.goto(route);
    await expect(page, route).toHaveURL(/\/$/);
  }
});

test("@catalog best-sellers redirects to the shop", async ({ page }) => {
  await page.goto("/best-sellers");
  await expect(page).toHaveURL(/\/shop$/);
});
