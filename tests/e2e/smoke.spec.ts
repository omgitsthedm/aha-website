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

test("@care Little Fight care mark matches the approved responsive contract", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const careBar = page.locator('aside[aria-label="Little Fight NYC design and care credit"]');
  const credit = careBar.getByRole("link", {
    name: "Designed, Built and Cared For By LittleFightNYC.com",
  });

  await expect(careBar).toBeVisible();
  await expect(credit).toHaveAttribute("href", "https://littlefightnyc.com/");
  await expect(credit).toHaveAttribute("rel", "author");
  await expect(careBar.locator('img[alt=""]')).toHaveCount(1);
  await expect(careBar).toHaveCSS("background-color", "rgb(5, 5, 7)");
  await expect(careBar.locator(".lf-care-bar__brand")).toHaveCSS("color", "rgb(249, 115, 22)");
  await expect(careBar.locator(".lf-tug-stage img")).toHaveCSS("animation-name", "none");

  const box = await careBar.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeLessThanOrEqual(testInfo.project.use.viewport?.width ?? Infinity);
});

test("@catalog shop lists products and links to PDPs", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/catalog/i);
  const firstProduct = page.locator('a[href^="/product/"]').first();
  await expect(firstProduct).toBeVisible();
});

test("@product @cart @checkout PDP shows price and a working Add to bag", async ({ page }, testInfo) => {
  await page.addInitScript(() => window.localStorage.setItem("aha-cookie-consent", "granted"));
  await page.goto("/product/dont-fuck-fascists-shirt");
  await expect(page).toHaveURL(/\/product\/dont-fuck-fascists-shirt/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator('#size-selector button[aria-pressed="true"]')).toHaveCount(0);
  const firstAvailableSize = page.locator('#size-selector button[aria-pressed]:not([disabled])').first();
  if (await firstAvailableSize.count()) await firstAvailableSize.click();
  const addToBag = page.getByRole("button", { name: /Add to bag/i }).first();
  await expect(addToBag).toBeVisible();
  // The mobile project verifies the CTA is reachable; the click flow runs on
  // chromium to keep the pack fast and deterministic.
  if (testInfo.project.name.startsWith("mobile-")) {
    const box = await addToBag.boundingBox();
    expect(box).not.toBeNull();
    return;
  }
  await expect(addToBag).toBeEnabled();
  await addToBag.click();
  await expect(page.getByRole("heading", { name: "Added to bag" })).toBeVisible();
  if (testInfo.project.name === "chromium") {
    const checkoutEntry = page.getByRole("link", { name: /^Checkout —/ });
    await expect(checkoutEntry).toBeInViewport();
    const checkoutBox = await checkoutEntry.boundingBox();
    const viewport = page.viewportSize();
    expect(checkoutBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect((checkoutBox?.y ?? Infinity) + (checkoutBox?.height ?? Infinity)).toBeLessThanOrEqual(viewport?.height ?? 0);
    // M1 relabelled these: the modal's button is "Open bag" (it opens the
    // drawer), and the drawer's "Review bag" link is the only route to /cart.
    // Both were "Review bag" before, which is the ambiguity M1 removed.
    // `exact` matters: the nav bag button is labelled "Open bag, 1 item", so a
    // substring match resolves to two elements and fails strict mode.
    await page.getByRole("button", { name: "Open bag", exact: true }).click();
    await page.getByRole("link", { name: "Review bag" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await page.getByRole("link", { name: "Continue to checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  }
});

test("@product a tap on the sticky mobile buy CTA reaches the buy button, not feedback", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "The sticky buy bar and overlap only exist at mobile widths.");
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

test("@catalog @cart cart page renders its empty state", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).toContainText(/bag|cart/i);
});

test("@operations order tracking fails closed without a match", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile-"), "Provider-backed operation is browser-independent and covered in Chromium.");
  await page.goto("/track-order");
  await expect(page).toHaveTitle(/Track/i);
  await page.getByLabel("Order number").fill("AHA-NOT-A-REAL-ORDER");
  await page.getByLabel("Checkout email").fill("nobody@example.com");
  await page.getByRole("button", { name: /Check order status/i }).click();
  await expect(page.locator("p[role='alert']")).toContainText(/No matching order|temporarily unavailable/, { timeout: 10_000 });
});

test("@security the production CSP is present on the document", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};
  const csp = headers["content-security-policy"] || "";
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("https://web.squarecdn.com");
  expect(csp).not.toContain("upgrade-insecure-requests");
  expect(headers["x-xss-protection"]).toBeUndefined();
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("@security security.txt exposes the canonical disclosure basics", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Static security disclosure is browser-independent.");
  const response = await page.request.get("/.well-known/security.txt");
  expect(response.status()).toBe(200);
  const fields = Object.fromEntries(
    (await response.text())
      .trim()
      .split("\n")
      .map((line) => line.split(/:\s+/, 2) as [string, string])
  );

  expect(fields.Contact).toBe("mailto:info@afterhoursagenda.com");
  expect(fields.Canonical).toBe("https://afterhoursagenda.com/.well-known/security.txt");
  expect(Date.parse(fields.Expires)).toBeGreaterThan(Date.now());
});

test("@seo indexable pages expose matching canonical and Open Graph URLs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Server metadata is browser-independent.");
  for (const route of ["/", "/shop", "/contact", "/privacy", "/terms", "/accessibility"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const expectedUrl = `https://afterhoursagenda.com${route === "/" ? "" : route}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", expectedUrl);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", expectedUrl);
  }
});

test("@seo missing routes return one noindex directive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Server metadata is browser-independent.");
  const response = await page.goto("/this-page-should-not-exist");
  expect(response?.status()).toBe(404);
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveCount(1);
  await expect(robots).toHaveAttribute("content", /noindex/);
});

test("@operations the ops sign-in surface renders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile-"), "Auth surface is browser-independent and covered in Chromium.");
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

test("@catalog product imagery fails gracefully when the image CDN is unavailable", async ({ page }) => {
  await page.route("**/__image_failure__/**", (route) =>
    route.fulfill({ status: 404, contentType: "text/plain", body: "missing" }),
  );
  await page.goto("/shop");
  const image = page.locator('a[href^="/product/"] img').first();
  await expect(image).toBeVisible();
  // Prove React attached this element's event props before inducing a real
  // image error. WebKit can decode a priority image before hydration finishes.
  await expect.poll(() => image.evaluate((element) =>
    Object.keys(element).some((key) => key.startsWith("__reactProps$")),
  )).toBe(true);
  await image.evaluate((element) => {
    const imageElement = element as HTMLImageElement;
    imageElement.removeAttribute("srcset");
    imageElement.src = `/__image_failure__/${crypto.randomUUID()}.webp`;
  });
  await expect(page.getByText("Image unavailable").first()).toBeVisible();
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
});

test("@brand manifesto page renders the flag and the signup", async ({ page }) => {
  const response = await page.goto("/manifesto");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/permission/i);
  await expect(page.getByRole("link", { name: "Shop the label" })).toBeVisible();
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
});
