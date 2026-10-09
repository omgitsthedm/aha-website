import { test, expect } from "@playwright/test";
const production = process.env.AHA_PRODUCTION_BUILD === "approved";
test("search handles words and a real empty state", async ({ page }) => {
  await page.goto("/search/");
  await page.getByLabel("Search pieces, stories and help").fill("tracking");
  await expect(page.locator("[data-search-result]:visible")).toHaveCount(1);
  await page
    .getByLabel("Search pieces, stories and help")
    .fill("nothingmatches12345");
  await expect(page.locator("#search-empty")).toBeVisible();
});
test("fit conversion responds without inventing a clothing size", async ({
  page,
}) => {
  await page.goto("/size-guide/");
  await page.getByLabel("Your measurement").fill("25");
  await expect(page.locator("#measure-result")).toContainText(
    "63.5 centimeters",
  );
  await page.getByLabel("Measured in").selectOption("cm");
  await expect(page.locator("#measure-result")).toContainText("9.8 inches");
  await page.getByLabel("Your measurement").fill("");
  await expect(page.locator("#measure-result")).toContainText(
    "Enter a measurement",
  );
});
test("saved pieces survive a reload and can be removed", async ({ page }) => {
  test.skip(
    production,
    "Unapproved collection studies are never published to production.",
  );
  await page.goto("/pieces/yikes/");
  await page.getByRole("button", { name: "Save this piece" }).click();
  await page.goto("/saved/");
  await expect(page.locator("[data-saved-list]")).toContainText("Yikes");
  await page.reload();
  await expect(page.locator("[data-saved-list]")).toContainText("Yikes");
  await page.locator('[data-save="yikes"]').click();
  await expect(page.locator("[data-saved-empty]")).toBeVisible();
});
test("blocked device storage does not break saving or the page", async ({
  page,
}) => {
  test.skip(production, "No concept products on the published site.");
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Blocked");
      },
    }),
  );
  await page.goto("/pieces/yikes/");
  await page.getByRole("button", { name: "Save this piece" }).click();
  await expect(page.locator('[data-save="yikes"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-storage-feedback]")).toContainText("visit");
});
test("order lookup rejects a mismatch and displays only the fictional fixture", async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.BASE_URL) && production,
    "Never probe real customer records.",
  );
  await page.goto("/track-order/");
  await page.getByLabel("Order number").fill("AHA-DEMO-1001");
  await page.getByLabel("Checkout email").fill("review@example.com");
  await page.getByLabel("Shipping ZIP").fill("99999");
  await page.getByRole("button", { name: "Look up order" }).click();
  await expect(page.locator("#track-status")).toContainText("No review order");
  await page.getByLabel("Shipping ZIP").fill("10001");
  await page.getByRole("button", { name: "Look up order" }).click();
  await expect(page.locator("#order-result")).toContainText("Sample garment");
  await expect(page.locator("#track-status")).toContainText(
    "No customer records",
  );
});
test("newsletter requires separate consent and never posts from a preview", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  if (production)
    await page.route("**/__forms.html", (route) => {
      expect(route.request().postData()).toContain("marketing-consent=yes");
      return route.fulfill({ status: 200, body: "Local test" });
    });
  await page.goto("/updates/");
  await page.getByLabel("Your email").fill("review@example.com");
  await page.getByRole("button", { name: "Join the list" }).click();
  expect(writes).toHaveLength(0);
  await page.locator('input[name="marketing-consent"]').check();
  await page.getByRole("button", { name: "Join the list" }).click();
  await expect(page.locator(".form-result")).toContainText(
    production ? "on the list" : "Nothing was sent",
  );
  if (!production) expect(writes).toHaveLength(0);
});
test("optional measurement stays off before consent and follows privacy controls", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/metrics")) writes.push(r.postData() || "");
  });
  await page.route("**/api/metrics", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: '{"accepted":true}',
    }),
  );
  await page.goto("/privacy/");
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Allow measurement" }).click();
  if (production) await expect.poll(() => writes.length).toBeGreaterThan(0);
  else expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Keep measurement off" }).click();
  await expect(page.locator("[data-privacy-status]")).toContainText("off");
  const before = writes.length;
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("aha:conversion", { detail: "support_request" }),
    ),
  );
  expect(writes).toHaveLength(before);
});
test("Global Privacy Control wins over stored permission", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("aha:measurement:v1", "allow");
    Object.defineProperty(navigator, "globalPrivacyControl", {
      get: () => true,
    });
  });
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/metrics")) writes.push(r.url());
  });
  await page.goto("/privacy/");
  await page.getByRole("button", { name: "Allow measurement" }).click();
  await expect(page.locator("[data-privacy-status]")).toContainText(
    "browser privacy preference",
  );
  expect(writes).toHaveLength(0);
});
test("closed checkout never loads a payment provider and forged carts cannot charge", async ({
  page,
  request,
}) => {
  const providers: string[] = [];
  page.on("request", (r) => {
    if (/squarecdn|squareup/.test(r.url())) providers.push(r.url());
  });
  await page.goto("/checkout/");
  await expect(page.locator("#checkout-form")).toBeHidden();
  expect(providers).toHaveLength(0);
  const origin = process.env.BASE_URL || "http://127.0.0.1:48379";
  const result = await request.post("/api/create-payment", {
    headers: { origin },
    data: {
      lines: [{ squareVariationId: "FORGED", quantity: 1 }],
      sourceId: "fictional",
      quotedTotal: 1,
    },
  });
  expect(result.status()).toBe(409);
  expect((await result.json()).error).toContain("Nothing has been charged");
});
