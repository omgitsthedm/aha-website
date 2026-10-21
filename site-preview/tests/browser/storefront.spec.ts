import { photographedProduct, photosFor } from "../../src/data/photography";
import products from "../../src/data/products.json" with { type: "json" };
import { test, expect } from "./fixtures";
import { campaignProducts, collectionSlug, collectionsInOrder } from "../../src/data/collections";
import { OFF_SALE } from "../../server/catalog/off-sale.mjs";

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
  await form.getByRole("button", { name: "Sign up" }).click();
  await expect(form.locator("[data-signup-status]")).toHaveText("Enter a full email address, like name@example.com.");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  expect(sent).toEqual([]);
  await email.fill("  fan@example.com ");
  await form.getByRole("button", { name: "Sign up" }).click();
  await expect(form.locator("[data-signup-status]")).toHaveText("You're on the list. We'll write when something new is ready.");
  await expect(email).toBeHidden();
  expect(sent).toEqual([{ email: "fan@example.com", source: "updates", company: "" }]);
  expect(page.url()).not.toContain("fan");
});

test("the new-pieces band signs up from the home page and reports a failure plainly", async ({ page }) => {
  const sources: string[] = [];
  await page.route("**/api/updates/subscribe", async (route) => {
    sources.push((route.request().postDataJSON() as { source: string }).source);
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });
  await page.goto("/");
  const form = page.locator(".updates-band [data-signup]");
  await form.getByLabel("Get new drops by email").fill("fan@example.com");
  await form.getByRole("button", { name: "Sign up" }).click();
  await expect(form.locator("[data-signup-status]")).toHaveText("That didn't go through. Try again, or write to info@afterhoursagenda.com.");
  await expect(form.getByLabel("Get new drops by email")).toBeVisible();
  expect(sources).toEqual(["home"]);
});

test("home shows the approved four pieces and both hero garments", async ({ page }) => {
  await page.goto("/");
  const expected = ['nonna-s-sunday-supper-society-c1717-ivory', 'yikes-cropped-hoodie', 'mighty-micks-ss3000-navy', 'after-hours-agenda-heritage-beanie-sp12-black'];
  const links = await page.locator(".home-selection article.product-card a").evaluateAll(items => [...new Set(items.map(item => item.getAttribute('href')))]);
  expect(links).toEqual(expected.map(slug => `/shop/${slug}/`));
  await expect(page.locator('.hero-photo a')).toHaveCount(2);
  await expect(page.locator('.hero-words .button')).toHaveText('Shop it all');
});

test("menu categories and search reach the matching garments on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Find your fit.' });
  await menu.getByRole('searchbox', { name: 'Find a piece', exact: true }).fill('Yikes');
  await expect(menu.locator('#menu-result-status')).toHaveText('2 pieces found');
  await expect(menu.locator('#menu-results a:visible')).toHaveCount(2);
  await menu.getByRole('searchbox', { name: 'Find a piece', exact: true }).press('Escape');
  await expect(menu.getByRole('searchbox', { name: 'Find a piece', exact: true })).toHaveValue('');
  await expect(menu.locator('#menu-browse')).toBeVisible();
  await expect(menu.locator('#menu-results')).toBeHidden();
  await menu.getByRole('searchbox', { name: 'Find a piece', exact: true }).fill('');
  await menu.getByRole('link', { name: /^Tees/ }).click();
  await expect(page).toHaveURL(/type=tees/);
  const cards = page.locator('article.product-card:visible');
  expect(await cards.count()).toBeGreaterThan(0);
  expect(await cards.evaluateAll(items => items.every(item => (item as HTMLElement).dataset.type === 'tees'))).toBe(true);
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
  const added = page.getByRole("region", { name: "Added to your bag" });
  await expect(added).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(added).toBeHidden();
  await expect(bar.getByRole("button", { name: "View bag" })).toBeVisible();
  await bar.getByRole("button", { name: "View bag" }).click();
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
  for (const path of ["/", "/updates/", "/about/", "/lookbook/", "/faq/"]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const width = await page.evaluate(() => {
      document.querySelectorAll<HTMLInputElement>("input[name=email]").forEach((input) => { input.size = 60; });
      return document.documentElement.scrollWidth;
    });
    expect(width, path).toBeLessThanOrEqual(320);
  }
});

test("adding to the bag opens a card with the piece, the subtotal and Checkout, without blocking the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/shop/the-city-ss4500-black/");
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.locator("[data-cart-quantity]").fill("2");
  const add = page.getByRole("button", { name: "Add to bag" });
  await add.click();
  const card = page.getByRole("region", { name: "Added to your bag" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("The City Hoodie");
  await expect(card).toContainText("Size M · Qty 2");
  await expect(card).toContainText("Bag subtotal · 2 items");
  await expect(card).toContainText("$116.00");
  await expect(card.getByRole("link", { name: "Checkout" })).toHaveAttribute("href", "/checkout/");
  await card.getByRole("button", { name: "Keep shopping" }).click();
  await expect(card).toBeHidden();
  await expect(add).toBeFocused();
  await add.click();
  await expect(card).toContainText("Bag subtotal · 4 items");
  await page.getByRole("link", { name: /Bag, 4 items/ }).click();
  await expect(page).toHaveURL(/\/checkout\/$/);
});

test("product pages link the same garment in its other colors", async ({ page }) => {
  await page.goto("/shop/mighty-micks-ss3000-navy/");
  const other = page.locator(".color-options").getByRole("link", { name: "Dark Green" });
  await expect(other).toHaveAttribute("href", "/shop/mighty-micks-ss3000-dark-green/");
  await page.goto("/shop/the-city-ss4500-black/");
  await expect(page.locator(".color-options")).toHaveCount(0);
});

test("the shop filter and search narrow the flat garment grid", async ({ page }) => {
  await page.goto("/shop/");
  const filter = page.getByRole("group", { name: "Show" });
  await filter.getByRole("button", { name: "Hoodies" }).click();
  await expect(filter.getByRole("button", { name: "Hoodies" })).toHaveAttribute("aria-pressed", "true");
  const visible = page.locator("article.product-card:visible");
  expect(await visible.evaluateAll((cards) => cards.every((card) => (card as HTMLElement).dataset.type === "hoodies"))).toBe(true);
  expect(await visible.count()).toBeGreaterThan(0);
  await filter.getByRole("button", { name: "All pieces", exact: true }).click();
  await expect(page.locator('article.product-card:visible')).toHaveCount(45);
  await page.getByRole('searchbox', { name: 'Find a garment, color or design' }).fill('Mighty');
  await expect(page.locator('article.product-card:visible')).toHaveCount(2);
});

test("hovering a product card swaps to its second view; the image loads only on hover", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/shop/");
  const card = page.locator(".product-card-image").first();
  await expect(card.locator(".product-card-swap")).toHaveCount(0);
  await card.hover();
  await expect(card).toHaveClass(/has-swap/);
  await expect(card.locator(".product-card-swap")).toHaveAttribute("src", (await card.getAttribute("data-swap-src"))!);
});

test("phone product photos show a count and open full screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop/the-city-ss4500-black/");
  const count = page.locator(".gallery-count");
  await expect(count).toHaveText("1 / 4");
  await page.locator(".product-gallery").evaluate((gallery) => { gallery.scrollLeft = (gallery.children[1] as HTMLElement).offsetLeft - (gallery.children[0] as HTMLElement).offsetLeft; });
  await expect(count).toHaveText("2 / 4");
  await page.getByRole("button", { name: "Enlarge photo: Front" }).click();
  const viewer = page.locator("dialog.photo-viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("img")).toHaveJSProperty("complete", true);
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

test("the lookbook has one set per collection, three looks each, every look linking to its piece", async ({ page }) => {
  await page.goto("/lookbook/");
  const names = collectionsInOrder().map(([name]) => name);
  const sets = page.locator("[data-look-set]");
  await expect(sets.locator("h2")).toHaveText(names);
  for (const set of await sets.all()) {
    await expect(set.locator("figure")).toHaveCount(3);
    await expect(set.locator(".look-chip")).toHaveCount(3);
  }
  await expect(page.locator(".campaign-set .look-chip").first()).toHaveAttribute("href", /^\/shop\/[a-z0-9-]+\/$/);
  await expect(sets.first().getByRole("link", { name: `Shop the pieces` })).toHaveAttribute("href", `/shop/${collectionSlug(names[0]!)}/`);
  // Every frame must link to the exact garment shown, including newly supplied shoots.
  for (const figure of await page.locator('[data-product-set]').all()) {
    const slug = await figure.getAttribute('data-product-set');
    const product = products.find(product => product.slug === slug)!;
    await expect(figure.locator('.look-chip')).toHaveAttribute('href', `/shop/${slug}/`);
    expect(photosFor(product).map(shot => shot.src)).toContain(await figure.locator('img').getAttribute('src'));
  }
});

test("the footer sign-up reports its section of the site, and Home keeps only its band", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/api/updates/subscribe", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/shop/the-city-ss4500-black/");
  const form = page.locator(".footer-signup [data-signup]");
  await form.getByLabel("Get new drops by email").fill("fan@example.com");
  await form.getByRole("button", { name: "Sign up" }).click();
  await expect(form.locator("[data-signup-status]")).toHaveText("You're on the list. We'll write when something new is ready.");
  expect(sent).toEqual([{ email: "fan@example.com", source: "shop", company: "" }]);
  await page.goto("/");
  await expect(page.locator("[data-signup]")).toHaveCount(1);
  await expect(page.locator(".footer-signup")).toHaveCount(0);
});

test("the header has one Shop trigger, in the main navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/about/");
  await expect(page.locator(".site-header [data-open-menu]:visible")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Shop", exact: true })).toBeVisible();
});

test("the old manifesto address moves permanently to The story", async ({ page, request }) => {
  for (const path of ["/manifesto", "/manifesto/"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(response.headers()["location"], path).toBe("/about/#manifesto");
  }
  await page.goto("/manifesto/");
  await expect(page).toHaveURL(/\/about\/#manifesto$/);
  await expect(page.getByRole("heading", { name: /MADE TO WEAR/ })).toBeInViewport();
});

test("the shared header stays available while browsing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/shop/");
  const bar = page.locator("[data-header-bar]");
  await page.mouse.wheel(0, 900);
  await expect(bar).toBeInViewport();
  await page.mouse.wheel(0, -300);
  await expect(bar).toBeInViewport();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Find your fit.' })).toBeVisible();
});

test("product pages show a delivery estimate in the space reserved for it", async ({ page }) => {
  await page.goto("/shop/the-city-ss4500-black/");
  await expect(page.locator("[data-arrival]")).toContainText(/Estimated U\.S\. arrival: \w{3}, \w{3} \d{1,2} – \w{3}, \w{3} \d{1,2}/);
});

test("the fit profile suggests a size from the visitor's own top and remembers it", async ({ page }) => {
  await page.goto("/shop/the-city-ss4500-black/");
  await page.getByRole("button", { name: "Find my size" }).click();
  const dialog = page.getByRole("dialog", { name: "Find your size" });
  await dialog.getByLabel("Chest width").fill("21.5");
  await dialog.getByLabel("Body length").fill("28");
  await dialog.getByRole("button", { name: "Show my size" }).click();
  await expect(dialog.getByRole("status")).toContainText(/^Compared with your own top, \w+ is/);
  const pick = (await dialog.getByRole("button", { name: /^Select / }).textContent())!.replace("Select ", "");
  await dialog.getByRole("button", { name: `Select ${pick}` }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("radio", { name: pick, exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: `Your size: ${pick}` })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Your size: ${pick}` })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("aha-fit-v1"))).toBe(JSON.stringify({ chest: 21.5, length: 28 }));
  await page.getByRole("button", { name: `Your size: ${pick}` }).click();
  await page.getByRole("button", { name: "Forget my measurements" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Find my size" })).toBeVisible();
});

test("Buy now adds the piece and goes straight to checkout", async ({ page }) => {
  await page.goto("/shop/mighty-micks-ss3000-navy/");
  await page.getByRole("radio", { name: "L", exact: true }).check();
  await page.getByRole("button", { name: "Buy now" }).click();
  await expect(page).toHaveURL(/\/checkout\/$/);
  await expect(page.locator(".bag-line")).toHaveCount(1);
  await expect(page.locator(".bag-line")).toContainText("Mighty Mick’s Crewneck");
});

test("the bag card includes the delivery estimate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/shop/the-city-ss4500-black/");
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByRole("region", { name: "Added to your bag" })).toContainText(/Estimated U\.S\. arrival/);
});

test("the private order page shows progress, tracking and items from its signed link", async ({ page }) => {
  await page.route("**/api/orders/status?**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ orderNumber: "1042", stage: "shipped", paidAt: "2026-10-16T18:00:00.000Z", items: [{ title: "The City Hoodie", size: "M", quantity: 1 }], tracking: [{ carrier: "USPS", number: "9400", url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400" }] }) }));
  await page.goto("/order/?o=ORDER123456&k=signed");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Order 1042");
  await expect(page.locator("[data-step='shipped']")).toHaveAttribute("aria-current", "");
  await expect(page.getByRole("link", { name: "Track with USPS" })).toHaveAttribute("href", /tools\.usps\.com/);
  await expect(page.locator("[data-order-items]")).toContainText("1 × The City Hoodie · M");
  await page.unroute("**/api/orders/status?**");
  await page.route("**/api/orders/status?**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "We couldn't find that order. Use the link in your order email." }) }));
  await page.goto("/order/?o=ORDER123456&k=wrong");
  await expect(page.locator("[data-order-lede]")).toHaveText("We couldn't find that order. Use the link in your order email.");
  await expect(page.locator("[data-order-steps]")).toBeHidden();
});

test("each collection has its own page with its pieces, campaign and share image", async ({ page }) => {
  const { collectionSlug } = await import("../../src/data/collections");
  for (const [name, pieces] of collectionsInOrder()) {
    await page.goto(`/shop/${collectionSlug(name)}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.locator("#pieces article.product-card")).toHaveCount(pieces.length);
    const pictured = campaignProducts(pieces.map(photographedProduct))[0]!;
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new URL(pictured.campaign[0]!.feedImage, 'https://afterhoursagenda.com').href.replace('https://afterhoursagenda.com', new URL((await page.locator('link[rel="canonical"]').getAttribute('href'))!).origin));
    const schema = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent())!);
    expect(schema["@type"]).toBe("CollectionPage");
    expect(schema.mainEntity.itemListElement).toHaveLength(pieces.length);
  }
  await page.goto("/lookbook/");
  await page.getByRole("region", { name: "The City", exact: true }).getByRole("link", { name: "Shop the pieces", exact: true }).click();
  await expect(page).toHaveURL(/\/shop\/the-city\/$/);
});

test("a collection whose pieces were all removed says so", async ({ page }) => {
  await page.route("**/api/catalog/live", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ known: true, retired: ["pet-it-be-ss3000-maroon"], retiredVariations: [], products: [], cartLines: [] }) }));
  await page.goto("/shop/pet-it-be/");
  await expect(page.locator("[data-collection-empty]")).toBeVisible();
  await expect(page.locator("#pieces article.product-card")).toBeHidden();
  await page.goto("/shop/the-city/");
  await expect(page.locator("[data-collection-empty]")).toBeHidden();
});

test("product pages show how to measure, and Find my size repeats the drawing", async ({ page }) => {
  await page.goto("/shop/the-city-ss4500-black/");
  await expect(page.getByRole("img", { name: "How to measure a top" })).toBeVisible();
  await page.getByRole("button", { name: "Find my size" }).click();
  await expect(page.locator(".fit-dialog .measure-diagram")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("img", { name: "How to measure a top" })).toHaveCount(1);
});

test.describe("campaign motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("a collection with a film shows its photo first, then plays and can be paused", async ({ page }) => {
    await page.goto("/shop/yikes/");
    const frame = page.locator(".collection-hero-image .motion-frame");
    await expect(frame.locator("img")).toBeVisible();
    await expect(frame).toHaveClass(/is-moving/, { timeout: 15_000 });
    // The film's layer shows the photo's own file until the film plays (see motion.ts).
    expect(await frame.locator("video").evaluate((element: HTMLVideoElement) => element.poster)).toBe(await frame.locator("img").evaluate((element: HTMLImageElement) => element.currentSrc));
    const video = frame.locator("video");
    await expect(video).toHaveAttribute("aria-hidden", "true");
    expect(await video.evaluate((element: HTMLVideoElement) => element.muted && element.loop && !element.paused)).toBe(true);
    await expect(page.locator(".collection-hero-image figcaption")).toContainText(/garment shots AI-generated/);
    await expect(page.locator(".collection-hero-image figcaption .still-note")).toBeHidden();
    const toggle = frame.getByRole("button", { name: "Pause the motion" });
    await toggle.click();
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await frame.getByRole("button", { name: "Play the motion" }).click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
  });

  test("the full-screen phone lookbook gets the film cut for its crop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/lookbook/");
    const frame = page.locator(".campaign-set .motion-frame[data-motion]").first();
    await frame.scrollIntoViewIfNeeded();
    await expect(frame.locator("video")).toHaveCount(1, { timeout: 15_000 });
    expect(await frame.getAttribute("data-motion-small")).toMatch(/-600t\.mp4$/);
    await expect(frame.locator("video")).toHaveAttribute("src", (await frame.getAttribute("data-motion-small"))!, { timeout: 15_000 });
  });

  test("phones get the lighter film", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop/yikes/");
    const video = page.locator(".collection-hero-image video");
    await expect(video).toHaveCount(1, { timeout: 15_000 });
    await expect(video).toHaveAttribute("src", (await page.locator(".collection-hero-image .motion-frame").getAttribute("data-motion-small"))!, { timeout: 15_000 });
  });
});

test("reduced motion keeps the still photos", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(3000);
  await expect(page.locator(".motion-frame video")).toHaveCount(0);
  await expect(page.locator(".hero-photo video")).toBeHidden();
});

test("a product off sale stays hidden without script, and shows again if it's restored in the admin", async ({ page, browser }) => {
  const slug = OFF_SALE[0]!;
  // Without script: hidden card, hidden collection group and jump link, noindex product page.
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noScript.newPage();
  await plain.goto(`${process.env.BASE_URL || "http://127.0.0.1:48379"}/shop/`);
  await expect(plain.locator(`article[data-off-sale="${slug}"]`)).toBeHidden();
  await expect(plain.getByRole("link", { name: "Pet It Be", exact: true })).toHaveCount(0);
  await plain.goto(`${process.env.BASE_URL || "http://127.0.0.1:48379"}/shop/${slug}/`);
  await expect(plain.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  await noScript.close();
  // Live state says it's still removed: stays hidden, and its page offers nothing to buy.
  await page.goto(`/shop/${slug}/`);
  await expect(page.getByText("This piece is no longer available.")).toBeVisible();
  await expect(page.locator("[data-arrival]")).toHaveCount(0);
  await expect(page.locator("[data-save]")).toHaveCount(0);
  // Restored in the admin: the card, its group and jump link come back without a deploy.
  await page.route("**/api/catalog/live", (route) => route.fulfill({ json: { known: true, products: [], cartLines: [], retired: [], retiredVariations: [] } }));
  await page.goto("/shop/");
  await expect(page.locator(`article[data-off-sale="${slug}"]`)).toBeVisible();
  await expect(page.locator(`article[data-off-sale="${slug}"] a`).first()).toHaveAttribute("href", `/shop/${slug}/`);
  await page.goto(`/shop/${slug}/`);
  await expect(page.locator("[data-cart-form]")).toBeVisible();
  // If the live state can't be read, the build's decision stands: a failed request,
  // or an answer that couldn't read the admin's removed list.
  await page.route("**/api/catalog/live", (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto("/shop/");
  await expect(page.locator(`article[data-off-sale="${slug}"]`)).toBeHidden();
  await page.route("**/api/catalog/live", (route) => route.fulfill({ json: { known: false, products: [], cartLines: [], retired: [], retiredVariations: [] } }));
  await page.goto("/shop/");
  await expect(page.locator(`article[data-off-sale="${slug}"]`)).toBeHidden();
  await page.goto(`/shop/${slug}/`);
  await expect(page.getByText("This piece is no longer available.")).toBeVisible();
  await expect(page.locator("[data-arrival]")).toHaveCount(0);
  await page.route("**/api/catalog/live", (route) => route.fulfill({ status: 503, body: "" }));
  await page.goto(`/shop/${slug}/`);
  await expect(page.getByText("This piece is no longer available.")).toBeVisible();
  await expect(page.locator("[data-cart-form]")).toHaveCount(0);
});
