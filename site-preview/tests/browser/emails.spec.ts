import { test, expect } from "./fixtures";
import { unsubscribeLinks } from "../../server/notifications/unsubscribe.mjs";
import { LOCAL_ORDER_SECRET } from "../../scripts/local-accounts.mjs";
import products from "../../src/data/products.json" with { type: "json" };

// The local server runs the real unsubscribe handler on an in-memory database
// with one queued bag reminder (row 1); see scripts/local-accounts.mjs.
test.skip(Boolean(process.env.BASE_URL), "unsubscribing is checked against the local handler");

test("the unsubscribe page takes an address off in one click, and explains a bad link", async ({ page }) => {
  const links = unsubscribeLinks(1, { get: (key: string) => (key === "AHA_ORDER_LINK_SECRET" ? LOCAL_ORDER_SECRET : undefined) }, "")!;
  await page.goto(links.page);
  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  await page.getByRole("button", { name: "Unsubscribe me" }).click();
  await expect(page.locator("[data-unsubscribe-status]")).toHaveText("You’re unsubscribed. You won’t get these emails again.");
  await expect(page.getByRole("button", { name: "Unsubscribe me" })).toBeHidden();
  await page.goto("/unsubscribe/?n=1&k=wrong");
  await page.getByRole("button", { name: "Unsubscribe me" }).click();
  await expect(page.locator("[data-unsubscribe-status]")).toContainText("isn’t valid");
  await page.goto("/unsubscribe/");
  await expect(page.getByRole("button", { name: "Unsubscribe me" })).toBeHidden();
  await expect(page.locator("[data-unsubscribe-status]")).toContainText("Open the unsubscribe link");
});

test("the bag-reminder link puts the pieces back in the bag and cleans the address bar", async ({ page }) => {
  const crew = products.find((product) => product.slug === "yikes-crewneck")!;
  const hoodie = products.find((product) => product.slug === "yikes-cropped-hoodie")!;
  await page.addInitScript((id) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("aha-cart-v2", JSON.stringify([{ variationId: id, quantity: 1 }])); sessionStorage.setItem("seeded", "1"); } }, crew.variants[2]!.id);
  await page.goto(`/checkout/?bag=${crew.variants[2]!.id}:2,${hoodie.variants[0]!.id}:1,NOTAPRODUCT:4`);
  await expect(page).toHaveURL(/\/checkout\/$/);
  const bag = await page.evaluate(() => JSON.parse(localStorage.getItem("aha-cart-v2") || "[]"));
  expect(bag).toEqual([{ variationId: crew.variants[2]!.id, quantity: 2 }, { variationId: hoodie.variants[0]!.id, quantity: 1 }]);
  await expect(page.locator("[data-cart-count]").first()).toHaveText("3");
});
