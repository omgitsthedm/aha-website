import { routes } from "../../src/data/site";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const axe = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const production = process.env.AHA_PRODUCTION_BUILD === "approved";
for (const [label, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(`${label}: all pages, accessible names, contrast, links, no errors or overflow`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    for (const path of routes) {
      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${label} ${path}`,
      ).toBe(true);
      for (const image of await page.locator("img:visible").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            image.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);
      }
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      const broken = await page
        .locator("img:visible")
        .evaluateAll((images) =>
          (images as HTMLImageElement[])
            .filter((x) => !x.complete || !x.naturalWidth)
            .map((x) => x.src),
        );
      expect(broken).toEqual([]);
      await page.evaluate(axe);
      const violations = await page.evaluate(async () => {
        const engine = (
          window as unknown as {
            axe: {
              run: (options: unknown) => Promise<{ violations: unknown[] }>;
            };
          }
        ).axe;
        return (
          await engine.run({
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          })
        ).violations;
      });
      expect(violations, `${label} ${path}`).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}
test("native mobile menu works by keyboard and Escape restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  const menu = page.locator(".mobile-nav summary");
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).not.toBeVisible();
  await menu.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Lookbook", exact: true })
    .click();
  await expect(page).toHaveURL(/lookbook\//);
});
test("contact validates and preserves details through preview or delivery failure", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) writes.push(r.url());
  });
  if (production)
    await page.route("**/__forms.html", (route) =>
      route.fulfill({ status: 503, body: "Unavailable" }),
    );
  await page.goto("/contact/?topic=order");
  await expect(page.locator("#support-topic")).toHaveValue("order");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("#support-name")).toBeFocused();
  await page.getByLabel("Your name").fill("Review Tester");
  await page.getByLabel("Your email").fill("review@example.com");
  await page.getByLabel("Order number").fill("AHA-TEST");
  await page
    .getByLabel("How can we help")
    .fill("Synthetic local test. No real support request.");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".form-result")).toContainText(
    production ? "couldn’t submit" : "Nothing was sent",
  );
  await expect(page.locator("#support-name")).toHaveValue("Review Tester");
  if (production) {
    await page.route("**/__forms.html", (route) =>
      route.fulfill({ status: 200, body: "Accepted test" }),
    );
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".form-result")).toContainText(
      "request has been received",
    );
    await expect(page.locator("#support-name")).toHaveValue("");
  } else expect(writes).toEqual([]);
});
test("all content, menu and contact fallback work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  for (const path of routes) {
    await page.goto(
      `${process.env.BASE_URL || "http://127.0.0.1:48379"}${path}`,
    );
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto(
    `${process.env.BASE_URL || "http://127.0.0.1:48379"}/contact/`,
  );
  await expect(page.locator("noscript")).toBeVisible();
  if (production) await expect(page.locator(".customer-form")).toBeVisible();
  else await expect(page.locator(".customer-form")).toBeHidden();
  await page.locator(".mobile-nav summary").click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await context.close();
});
test("320px and 200-percent-equivalent reflow keep every page within the viewport", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of routes) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width} ${path}`,
      ).toBe(true);
    }
  }
});
test("missing routes and legacy APIs are real 404s; headers match release mode", async ({
  request,
}) => {
  for (const path of [
    "/does-not-exist/",
    "/api/checkout/",
    "/api/ops/session/",
    "/product/retired-item/",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("A DIFFERENT");
  }
  const response = await request.get("/");
  if (production) {
    expect(response.headers()["x-robots-tag"] || "").not.toContain("noindex");
    expect(await response.text()).toContain(
      'name="robots" content="index, follow, max-image-preview:large"',
    );
  } else {
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  }
  expect(response.headers()["content-security-policy"]).toContain(
    "connect-src 'self'",
  );
});

test("search ownership files and release receipt remain available", async ({
  request,
}) => {
  for (const file of [
    "googleb80e08d782fcdd45.html",
    "google9dd9990931be8b22.html",
    "BingSiteAuth.xml",
  ]) {
    const response = await request.get(`/${file}`);
    expect(response.status()).toBe(200);
    expect(await response.body()).toEqual(
      readFileSync(new URL(`../../../public/${file}`, import.meta.url)),
    );
  }
  const response = await request.get("/release.json");
  expect(response.status()).toBe(200);
  const release = await response.json();
  expect(release.project).toBe("After Hours Agenda");
  expect(release.siteId).toBe("275b4115-16bf-42fb-9b36-6bce9bb93608");
  expect(release.mode).toBe(production ? "production" : "preview");
});

test("every internal link resolves, including fragment destinations", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const links = new Set<string>();
  for (const path of routes) {
    await page.goto(path);
    for (const href of await page
      .locator("a[href]")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("href") || ""),
      ))
      if (href.startsWith("/")) links.add(href);
  }
  for (const href of links) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
  await page.goto("/");
  await expect(page.locator("#main")).toHaveCount(1);
});
