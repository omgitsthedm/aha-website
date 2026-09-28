import { test, expect } from "@playwright/test";
import { SELLABLE_PRODUCT_SLUGS } from "../../lib/commerce/sellable-slugs.generated";

// The one committed answer to "what is sellable" — the same set the storefront
// and the cart purge read, so a product cannot be added without this pack
// seeing it and nothing retired can sneak in beside it.
const CAPSULE_PDP_LINKS = [...SELLABLE_PRODUCT_SLUGS].map((slug) => `/product/${slug}`);

// Smoke pack for the catalog migration hold. Runs against a local production
// build (see e2e.yml) and proves the public storefront cannot expose the
// retired catalog, restore a saved legacy bag, or start a new checkout.

test("@catalog home keeps acquisition paths open without shopping controls", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/After Hours Agenda | For the dreamers and the doers/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/dreamers and the doers/i);
  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute("content", "#FF6B6B");
  await expect(page.locator('a[href^="/product/"]')).toHaveCount(0);
  await expect(page.getByTestId("home-collection-grid")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "The story" }).first()).toHaveAttribute("href", "/about");
  await expect(page.getByRole("link", { name: "Get updates" }).first()).toHaveAttribute("href", "#dispatch-heading");
  await expect(page.getByText("The previous collection is archived")).toHaveCount(0);
  await expect(page.locator("symbol#aha-sheep-mark")).toHaveCount(1);
  const filledMark = page.locator('svg[fill="currentColor"]:has(use[href="#aha-sheep-mark"])').first();
  const outlineMark = page.locator('svg[fill="none"]:has(use[href="#aha-sheep-mark"])').first();
  await expect(filledMark).toBeVisible();
  await expect(outlineMark).toBeVisible();
  expect(await filledMark.locator("use").evaluate((element) => (element as SVGGraphicsElement).getBBox().width)).toBeGreaterThan(0);
});

test("@care Little Fight credit mark closes every page and respects reduced motion", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // The credit closes the client's own footer, on the footer's own ground —
  // it is not a separate strip with a colour of its own.
  const footer = page.locator("footer").last();
  const credit = footer.getByRole("link", { name: "Made by Little Fight NYC" });

  await expect(credit).toBeVisible();
  await expect(credit).toHaveAttribute("href", "https://littlefightnyc.com");
  await expect(footer.locator(".lfc-beacon")).toHaveCount(1);
  // The mark draws itself — no image request, no webfont of its own.
  await expect(credit.locator("img")).toHaveCount(0);
  await expect(footer.locator(".lfc-hull")).toHaveCSS("animation-name", "none");

  const box = await credit.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeLessThanOrEqual(testInfo.project.use.viewport?.width ?? Infinity);
});

test("@privacy a fresh document includes the consent choice before hydration", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "SSR consent markup is browser-independent.");
  const response = await page.request.get("/");
  expect(response.status()).toBe(200);
  const html = await response.text();
  const headStart = html.indexOf("<head>");
  const headEnd = html.indexOf("</head>");
  const bodyStart = html.indexOf("<body");
  const bootstrap = html.indexOf('id="aha-consent-bootstrap"');
  expect(headStart).toBeGreaterThanOrEqual(0);
  expect(bootstrap).toBeGreaterThan(headStart);
  expect(bootstrap).toBeLessThan(headEnd);
  expect(headEnd).toBeLessThan(bodyStart);
  expect(html).toContain('aria-label="Cookie preferences"');
  expect(html).toContain('data-aha-consent-banner=""');
  expect(bootstrap).toBeLessThan(html.indexOf('data-aha-consent-banner=""'));
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

test("@privacy a local preview never mounts Google Analytics after stored consent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Host-bound analytics behavior is covered once in Chromium.");
  const googleRequests: string[] = [];
  page.on("request", (request) => {
    if (/googletagmanager|google-analytics|analytics\.google/i.test(request.url())) googleRequests.push(request.url());
  });
  await page.route(/https?:\/\/(?:www\.googletagmanager\.com|www\.google-analytics\.com|connect\.facebook\.net|www\.facebook\.com|analytics\.tiktok\.com)\//i, (route) => route.abort());
  await page.addInitScript(() => window.localStorage.setItem("aha-cookie-consent", "granted"));
  await page.goto("/");
  await page.waitForTimeout(150);
  expect(googleRequests).toEqual([]);
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

test("@privacy the consent choice owns mobile bottom surfaces while commerce is paused", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Fixed mobile controls are covered at phone width.");
  await page.goto("/shop");
  const banner = page.getByRole("dialog", { name: "Cookie preferences" });
  await expect(banner).toBeVisible();
  await expect(page.getByTestId("sticky-buy-bar")).toHaveCount(0);
  await expect(page.getByTestId("sticky-checkout-bar")).toHaveCount(0);
  await banner.getByRole("button", { name: "Reject" }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId("sticky-buy-bar")).toHaveCount(0);
  await expect(page.getByTestId("sticky-checkout-bar")).toHaveCount(0);
});

test("@catalog shop stays on the support-and-updates surface", async ({ page }) => {
  const response = await page.goto("/shop");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Shop temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get updates" })).toHaveAttribute("href", "/#dispatch-heading");
  await expect(page.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/contact");
  await expect(page.locator('a[href^="/product/"]')).toHaveCount(0);
});

test("@catalog catalog product paths stay unavailable while the shop is closed", async ({ page }) => {
  const response = await page.goto(CAPSULE_PDP_LINKS[0]);
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("button", { name: /Add to bag/i })).toHaveCount(0);
  await expect(page.getByTestId("sticky-buy-bar")).toHaveCount(0);
});

test("@product archived product routes return a noindex 404 without buy controls", async ({ page }) => {
  const response = await page.goto("/product/dont-fuck-fascists-shirt");
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("button", { name: /Add to bag/i })).toHaveCount(0);
  await expect(page.getByTestId("sticky-buy-bar")).toHaveCount(0);
});

test("@catalog retired product and campaign assets return 404", async ({ page }) => {
  for (const path of [
    "/products/dont-fuck-fascists-shirt/01-black-mens-fitted-t-shirt-front.webp",
    "/printful-assets/Dont_Fuck_Fascists_Shirt.png",
    "/campaign/hero-home.jpg",
  ]) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test("@cart cart paths render the support-and-updates surface", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Shop temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get updates" })).toHaveAttribute("href", "/#dispatch-heading");
  await expect(page.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/contact");
  await expect(page.getByText("Your bag")).toHaveCount(0);
});

test("@cart a legacy saved bag is cleared without restoring a cart surface", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Browser-storage restore is covered once in Chromium.");
  await page.addInitScript(() => {
    window.localStorage.setItem("aha-cart", JSON.stringify([{ productId: "preview-dont-fuck-fascists-shirt", variationId: "preview-dont-fuck-fascists-shirt-m", quantity: 1 }]));
  });
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Shop temporarily unavailable" })).toBeVisible();
  await expect(page.getByText("Your bag")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("aha-cart") || "[]"))).toEqual([]);
});

test("@checkout checkout stays paused and rejects a saved legacy line before payment", async ({ page }) => {
  const response = await page.goto("/checkout");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Checkout is paused" })).toBeVisible();
  await expect(page.getByText("Existing items cannot be purchased while the shop is temporarily unavailable.")).toBeVisible();

  const quote = await page.request.post("/api/checkout-quote", {
    data: {
      lines: [{ productId: "legacy-product", variationId: "legacy-variation", quantity: 1 }],
      contact: {
        shippingName: "Archive Test",
        shippingAddress: { address1: "1 Archive Way", city: "New York", state: "NY", zip: "10001", country: "US" },
      },
    },
  });
  expect(quote.status()).toBeGreaterThanOrEqual(400);
  const body = await quote.json();
  expect(JSON.stringify(body)).toMatch(/store is being updated|cannot be purchased/i);
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

test("@catalog shop exposes no product imagery while commerce is closed", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 1, name: "Shop temporarily unavailable" })).toBeVisible();
  await expect(page.locator('a[href^="/product/"]')).toHaveCount(0);
  await expect(page.locator('img[src*="/products/"]')).toHaveCount(0);
});

test("@brand manifesto page renders the flag and the signup", async ({ page }) => {
  const response = await page.goto("/manifesto");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/dreamers/i);
  await expect(page.getByRole("link", { name: "Get the next release first" })).toBeVisible();
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
});
