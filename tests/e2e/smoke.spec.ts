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

  await expect(page.locator("symbol#aha-sheep-mark")).toHaveCount(1);
  const filledMark = page.locator('svg[fill="currentColor"]:has(use[href="#aha-sheep-mark"])').first();
  const outlineMark = page.locator('svg[fill="none"]:has(use[href="#aha-sheep-mark"])').first();
  await expect(filledMark).toBeVisible();
  await expect(outlineMark).toBeVisible();
  expect(await filledMark.locator("use").evaluate((element) => (element as SVGGraphicsElement).getBBox().width)).toBeGreaterThan(0);
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

test("@privacy a fresh document includes the consent choice before hydration", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "SSR consent markup is browser-independent.");
  const response = await page.request.get("/");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('id="aha-consent-bootstrap"');
  expect(html).toContain('aria-label="Cookie preferences"');
  expect(html).toContain('data-aha-consent-banner=""');
  expect(html.indexOf('id="aha-consent-bootstrap"')).toBeLessThan(html.indexOf('data-aha-consent-banner=""'));
});

test("@privacy a stored choice stays hidden without a hydration warning and can reopen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Parser-time consent behavior is covered once in Chromium.");
  const hydrationMessages: string[] = [];
  page.on("console", (message) => {
    if (/hydration|did not match/i.test(message.text())) hydrationMessages.push(message.text());
  });
  await page.addInitScript(() => window.localStorage.setItem("aha-cookie-consent", "granted"));
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Do Not Sell or Share My Info" }).click();
  await expect(dialog).toBeVisible();
  expect(hydrationMessages).toEqual([]);
});

test("@privacy GPC overrides a stored grant and reopens with only the keep-off choice", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "GPC browser behavior is covered once in Chromium.");
  const trackingRequests: string[] = [];
  page.on("request", (request) => {
    if (/googletagmanager|google-analytics|facebook\.com\/tr|analytics\.tiktok/i.test(request.url())) {
      trackingRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("aha-cookie-consent", "granted");
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true });
  });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Do Not Sell or Share My Info" }).click();
  await expect(dialog.getByRole("button", { name: "Keep tracking off" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Accept" })).toHaveCount(0);
  expect(trackingRequests).toEqual([]);
});

test("@privacy unavailable storage still allows an in-tab consent choice", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Storage failure handling is browser-independent.");
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "aha-cookie-consent") throw new DOMException("Storage unavailable", "SecurityError");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "aha-cookie-consent") throw new DOMException("Storage unavailable", "SecurityError");
      return setItem.call(this, key, value);
    };
  });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Accept" }).click();
  await expect(dialog).toHaveCount(0);
});

test("@privacy the consent choice exclusively owns fresh mobile bottom surfaces", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Fixed mobile controls are covered at phone width.");
  await page.goto("/product/dont-fuck-fascists-shirt");
  const banner = page.getByRole("dialog", { name: "Cookie preferences" });
  const stickyBar = page.getByTestId("sticky-buy-bar");
  await expect(banner).toBeVisible();
  await expect(stickyBar).toBeHidden();
  await banner.getByRole("button", { name: "Reject" }).click();
  await expect(banner).toHaveCount(0);
  await expect(stickyBar).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.removeItem("aha-cookie-consent");
    window.localStorage.setItem("aha-cart", JSON.stringify([{
      productId: "preview-dont-fuck-fascists-shirt",
      slug: "dont-fuck-fascists-shirt",
      variationId: "preview-dont-fuck-fascists-shirt-m",
      name: "Don't Fuck Fascists Shirt",
      variationName: "M",
      price: 4000,
      priceFormatted: "$40.00",
      quantity: 1,
      image: "/products/dont-fuck-fascists-shirt/01-black-mens-fitted-t-shirt-front.webp",
    }]));
  });
  await page.goto("/cart");
  const cartBanner = page.getByRole("dialog", { name: "Cookie preferences" });
  const checkoutBar = page.getByTestId("sticky-checkout-bar");
  await expect(cartBanner).toBeVisible();
  await expect(checkoutBar).toBeHidden();
  await cartBanner.getByRole("button", { name: "Reject" }).click();
  await expect(checkoutBar).toBeVisible();
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
  await expect(page.getByText("Your bag is empty. Saved items stay on this device.")).toBeVisible();
});

test("@cart a saved bag restores without flashing the empty state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Browser-storage restore is covered once in Chromium.");
  await page.addInitScript(() => {
    window.localStorage.setItem("aha-cart", JSON.stringify([{
      productId: "preview-dont-fuck-fascists-shirt",
      slug: "dont-fuck-fascists-shirt",
      variationId: "preview-dont-fuck-fascists-shirt-m",
      name: "Don't Fuck Fascists Shirt",
      variationName: "M",
      price: 4000,
      priceFormatted: "$40.00",
      quantity: 1,
      image: "/products/dont-fuck-fascists-shirt/01-black-mens-fitted-t-shirt-front.webp",
    }]));
  });

  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Your bag" })).toBeVisible();
  await expect(page.getByText("Don't Fuck Fascists Shirt", { exact: true })).toBeVisible();
  await expect(page.getByText("Your bag is empty.")).toHaveCount(0);
});

test("@cart unavailable browser storage still reaches a usable empty bag", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Storage failure handling is browser-independent.");
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "aha-cart") throw new DOMException("Storage unavailable", "SecurityError");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "aha-cart") throw new DOMException("Storage unavailable", "SecurityError");
      return setItem.call(this, key, value);
    };
  });

  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Your bag" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start shopping" })).toBeVisible();
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
  expect(csp).toContain("https://www.gstatic.com");
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

test("@security release identity is public, non-indexable, and traceable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Release identity is browser-independent.");
  const response = await page.request.get("/release.json");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const release = await response.json();
  expect(release).toMatchObject({
    schemaVersion: 1,
    site: "afterhoursagenda.com",
    source: "omgitsthedm/aha-website",
  });
  expect(release.commit).toMatch(/^(local|[a-f0-9]{40})$/);
  expect(release.context).toEqual(expect.any(String));
  expect(release.branch).toEqual(expect.any(String));
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
  await expect(page.getByRole("textbox", { name: /Operations password/ })).toBeVisible();
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
