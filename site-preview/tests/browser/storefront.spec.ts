import { test, expect } from "@playwright/test";
import { collectionsInOrder } from "../../src/data/collections";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aha-cookie-choices-v1", JSON.stringify({ analytics: false, marketing: false, at: Date.now() })));
});

test("email sign-up checks the address and sends only the address and its page", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/api/updates/subscribe", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/updates/");
  const form = page.locator("[data-signup]");
  const email = form.getByLabel("Get new drops by email");
  await email.fill("not-an-address");
  await form.getByRole("button", { name: "Sign me up" }).click();
  await expect(form.locator("[data-signup-status]")).toHaveText("Enter a full email address, like name@example.com.");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  expect(sent).toEqual([]);
  await email.fill("  fan@example.com ");
  await form.getByRole("button", { name: "Sign me up" }).click();
  await expect(form.locator("[data-signup-status]")).toHaveText("You're on the list. We'll write when something new is ready.");
  await expect(email).toBeHidden();
  expect(sent).toEqual([{ email: "fan@example.com", source: "updates", company: "" }]);
  expect(page.url()).not.toContain("fan");
});

test("the Stay close band signs up from the home page and reports a failure plainly", async ({ page }) => {
  const sources: string[] = [];
  await page.route("**/api/updates/subscribe", async (route) => {
    sources.push((route.request().postDataJSON() as { source: string }).source);
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  const form = page.locator(".updates-band [data-signup]");
  await form.getByLabel("Get new drops by email").fill("fan@example.com");
  await form.getByRole("button", { name: "Sign me up" }).click();
  await expect(form.locator("[data-signup-status]")).toHaveText("That didn't go through. Try again, or write to info@afterhoursagenda.com.");
  await expect(form.getByLabel("Get new drops by email")).toBeVisible();
  expect(sources).toEqual(["home"]);
});

test("home features one piece from each collection, newest drop first", async ({ page }) => {
  await page.goto("/");
  const expected = collectionsInOrder().slice(0, 4).map(([, pieces]) => pieces.find((product) => product.typeLabel === "Hoodie") ?? pieces[0]!);
  await expect(page.locator("section[aria-labelledby='new-pieces'] article.product-card")).toHaveCount(4);
  const links = await page.locator("section[aria-labelledby='new-pieces'] article.product-card a").evaluateAll((items) => [...new Set(items.map((item) => item.getAttribute("href")))]);
  expect(links).toEqual(expected.map((product) => `/shop/${product.slug}/`));
  await expect(page.locator(".hero-image figcaption")).toContainText(expected[0]!.title);
});

test("shop jump links reach every collection on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop/");
  const jump = page.getByRole("navigation", { name: "Jump to a collection" });
  const names = collectionsInOrder().map(([name]) => name);
  await expect(jump.getByRole("link")).toHaveText(names);
  await jump.getByRole("link", { name: "The City" }).click();
  await expect(page).toHaveURL(/#collection-the-city$/);
  await expect(page.getByRole("heading", { name: "The City", exact: true })).toBeInViewport();
});

test("product pages on a phone keep price and the next step in a bar until the size picker is in view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop/the-city-ss4500-black/");
  const bar = page.getByRole("region", { name: "Quick add" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("The City Hoodie");
  await expect(bar).toContainText("$58");
  await bar.getByRole("button", { name: "Choose a size" }).click();
  await expect(bar).toBeHidden();
  await expect(page.locator("[data-cart-variant]").first()).toBeFocused();
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(bar.getByRole("button", { name: "Add M to bag" })).toBeVisible();
  await bar.getByRole("button", { name: "Add M to bag" }).click();
  await expect(page.locator(".header-cart [data-cart-count]")).toHaveText("1");
  await expect(bar.getByRole("button", { name: "View bag →" })).toBeVisible();
  await bar.getByRole("button", { name: "View bag →" }).click();
  await expect(page).toHaveURL(/\/checkout\/$/);
});

test("the quick-add bar stays off on desktop, where the details column is always in view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/shop/the-city-ss4500-black/");
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect(page.getByRole("region", { name: "Quick add" })).toBeHidden();
});

// Linux Chrome sizes text inputs from the font's widest glyph, so a sign-up input
// must never rely on its natural width; widen it on purpose and check reflow.
test("sign-up forms fit a 320px screen whatever the input's natural width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const path of ["/", "/updates/", "/about/", "/lookbook/", "/manifesto/"]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const width = await page.evaluate(() => {
      document.querySelectorAll<HTMLInputElement>("input[name=email]").forEach((input) => { input.size = 60; });
      return document.documentElement.scrollWidth;
    });
    expect(width, path).toBeLessThanOrEqual(320);
  }
});
