import { test, expect } from "@playwright/test";
import products from "../../src/data/products.json" with { type: "json" };

test("cart: new collection colors and sizes coexist with Yikes through a checkout reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aha-cookie-choices-v1", JSON.stringify({analytics:false,marketing:false,at:Date.now()})));
  const slugs = ["yikes-crewneck", "insomniac-ss4500-black", "insomniac-comfort-colors-4410-grey"];
  const selected = slugs.map(slug => products.find(product => product.slug === slug)!);
  for (const product of selected) {
    await page.goto(`/shop/${product.slug}/`);
    await page.getByRole("radio", {name:"M",exact:true}).check();
    await page.getByRole("button", {name:"Add to bag"}).click();
    await expect(page.locator("[data-cart-add-status]")).toContainText("added");
  }
  await page.goto("/checkout/");
  await page.reload();
  await expect(page.locator(".bag-line")).toHaveCount(3);
  for (const [index, product] of selected.entries()) {
    await expect(page.locator(".bag-line").nth(index)).toContainText(product.title);
    await expect(page.locator(".bag-line").nth(index)).toContainText(product.color);
    await expect(page.locator(".bag-line").nth(index).locator(".label")).toHaveText(`M · ${product.color}`);
  }
  await expect(page.locator("[data-cart-subtotal]")).toHaveText("$168.00");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("aha-cart-v2") || "[]"));
  expect(saved).toEqual(selected.map(product => ({variationId:product.variants.find(variant => variant.size === "M")!.id, quantity:1})));
});

test("cart: The City keeps three garment sizes and quantities in one persistent checkout", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aha-cookie-choices-v1", JSON.stringify({analytics:false,marketing:false,at:Date.now()})));
  const selections = [
    { slug: "the-city-ss4500-black", size: "2XL", quantity: 2, price: 58 },
    { slug: "the-city-ss3000-black", size: "3XL", quantity: 1, price: 55 },
    { slug: "the-city-next-level-3601-black", size: "S", quantity: 3, price: 42 },
  ].map((selection) => ({ ...selection, product: products.find((product) => product.slug === selection.slug)! }));
  expect(selections.every(({ product }) => product)).toBe(true);

  for (const { product, size, quantity } of selections) {
    await page.goto(`/shop/${product.slug}/`);
    await page.getByRole("radio", {name:size,exact:true}).check();
    await page.locator("[data-cart-quantity]").fill(String(quantity));
    await page.getByRole("button", {name:"Add to bag"}).click();
    await expect(page.locator("[data-cart-add-status]")).toContainText("added");
  }

  await page.goto("/checkout/");
  await page.reload();
  await expect(page.locator(".bag-line")).toHaveCount(3);
  for (const [index, { product, size, quantity }] of selections.entries()) {
    const line = page.locator(".bag-line").nth(index);
    await expect(line).toContainText(product.title);
    await expect(line).toContainText(product.color);
    await expect(line.locator(".label")).toHaveText(`${size} · ${product.color}`);
    await expect(line.getByRole("combobox")).toHaveValue(String(quantity));
  }
  await expect(page.locator("[data-cart-subtotal]")).toHaveText("$297.00");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("aha-cart-v2") || "[]"));
  expect(saved).toEqual(selections.map(({ product, size, quantity }) => ({
    variationId: product.variants.find((variant) => variant.size === size)!.id,
    quantity,
  })));
});

test("cart: PDP size and quantity add exact variants to a persistent shared bag", async ({ page }) => {
  await page.goto("/shop/yikes-crewneck/");
  await expect(page.locator("[data-cart-variant]:checked")).toHaveCount(0);
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.locator("[data-cart-add-status]")).toContainText("Choose a size");
  await expect(page.getByRole("link", { name: /Bag, 0 items/ })).toBeVisible();
  await page.getByRole("radio", { name: "M", exact: true }).check();
  await page.locator("[data-cart-quantity]").fill("2");
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.locator("[data-cart-add-status]")).toContainText("added");
  await expect(page.getByRole("link", { name: /Bag, 2 items/ })).toBeVisible();
  await page.goto("/shop/yikes-cropped-hoodie/");
  await page.getByRole("radio", { name: "L", exact: true }).check();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await page.getByRole("link", { name: /Bag, 3 items/ }).click();
  await expect(page.locator(".bag-line")).toHaveCount(2);
  await expect(page.locator(".bag-line").nth(0)).toContainText("Yikes! Crewneck");
  await expect(page.locator(".bag-line").nth(0).getByRole("combobox")).toHaveValue("2");
  await expect(page.locator(".bag-line").nth(1)).toContainText("Yikes! Cropped Hoodie");
  await expect(page.locator(".bag-line").nth(1).getByRole("combobox")).toHaveValue("1");
  await expect(page.locator("[data-cart-subtotal]")).toHaveText("$159.00");
});

test("cart: Meta-recovered selections merge safely into the existing bag and clear unsafe URL content", async ({ page }) => {
  await page.goto("/checkout/?products=KEQN72Y22B5RL3V5NFVACNWQ%3A2%2C3CAFSZ345DL6VRX5CNBI6YDQ%3A2&utm_source=instagram&email=private");
  await expect(page.locator(".bag-line")).toHaveCount(2);
  await expect(page.locator("[data-cart-subtotal]")).toHaveText("$214.00");
  await expect(page).toHaveURL(/utm_source=instagram$/);
  await expect(page).not.toHaveURL(/products=|email=/);
  await expect(page.locator("[data-checkout-panel]")).toBeVisible();
  await expect(page.locator("[data-quote]")).toBeVisible();
});

test("cart: retired or malicious recovered selections cannot become a bag line or provider request", async ({ page }) => {
  // Keep this provider-write assertion focused: default-on measurement is covered separately.
  await page.addInitScript(() => localStorage.setItem("aha-cookie-choices-v1", JSON.stringify({analytics:false,marketing:false,at:Date.now()})));
  const writes: string[] = [];
  page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url()); });
  await page.goto("/checkout/?products=retired%3A1&coupon=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
  await expect(page.locator(".bag-line")).toHaveCount(0);
  await expect(page.locator("[data-cart-empty]")).toBeVisible();
  await expect(page.locator("[data-checkout-message]")).toContainText("no longer available");
  expect(writes).toEqual([]);
});

test("cart: bag reflows at 320px and the checkout fallback remains useful without JavaScript", async ({ page, browser }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/checkout/?products=KEQN72Y22B5RL3V5NFVACNWQ%3A2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await context.newPage();
  await fallback.goto(`${process.env.BASE_URL || "http://127.0.0.1:48379"}/checkout/`);
  await expect(fallback.getByRole("heading", { name: "YOUR BAG." })).toBeVisible();
  await expect(fallback.getByRole("link", { name: "Browse the current pieces" })).toBeVisible();
  await context.close();
});
