import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { addBusinessDays, arrivalWindow, deliveryLines, holidayCutoff } from "../src/scripts/delivery.ts";
import { recommendSize } from "../src/scripts/fit.ts";
import { fitSummary } from "../src/scripts/fit-summary.ts";
import products from "../src/data/products.json" with { type: "json" };
import { measurementGuide } from "../server/catalog/garments.mjs";
import { recommendationsFor } from "../server/catalog/recommendations.mjs";
import { customerView, handleOrderStatus, orderStatusUrl, stageFor, verifyOrderToken } from "../server/orders/status.mjs";
import orderStatusFunction, { config as orderStatusConfig } from "../netlify/functions/order-status.mjs";
import { renderOrderConfirmation, renderShipment } from "../server/notifications/templates.mjs";

const day = (value) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("delivery estimates count business days and skip closed dates", () => {
  assert.equal(iso(addBusinessDays(day("2026-10-16"), 1)), "2026-10-19", "Friday + 1 business day is Monday");
  assert.equal(iso(addBusinessDays(day("2026-11-25"), 1)), "2026-11-30", "Thanksgiving and the day after are closed");
  const { earliest, latest, shipsBy } = arrivalWindow(day("2026-10-16"));
  assert.deepEqual([iso(earliest), iso(latest), iso(shipsBy)], ["2026-10-28", "2026-11-05", "2026-10-27"]);
  assert.equal(holidayCutoff(day("2026-10-16")), null, "no holiday notice before November");
  assert.equal(iso(holidayCutoff(day("2026-11-02")).orderBy), "2026-12-03");
  assert.ok(arrivalWindow(holidayCutoff(day("2026-11-02")).orderBy).latest <= day("2026-12-24"));
  assert.deepEqual(holidayCutoff(day("2026-12-10")), { orderBy: null, label: "December 24" });
  assert.match(deliveryLines(day("2026-12-10"))[1], /expected to arrive after December 24/);
});

test("fit profile picks the closest available width and declines an out-of-range top", () => {
  const rows = [{ size: "S", chest: 20, length: 27 }, { size: "M", chest: 22, length: 28 }, { size: "L", chest: 24, length: 29 }];
  assert.equal(recommendSize(rows, { chest: 21.5, length: 28 }).size, "M");
  assert.equal(recommendSize(rows, { chest: 22.2, length: 28 }).size, "M", "a quarter inch narrower still counts");
  assert.equal(recommendSize(rows, { chest: 26, length: 30 }), null, "a largest-size fallback would overpromise fit");
  assert.equal(fitSummary(rows[1], { chest: 21.5, length: 29 }), "Closest width: M is 0.5 in roomier across the chest and 1 in shorter. Length describes the garment's cut; it does not change this width comparison.");
  assert.equal(fitSummary(rows[1], { chest: 22, length: 28.1 }), "Closest width: M is the same width across the chest and the same length. Length describes the garment's cut; it does not change this width comparison.");
});

test("measurement tables state both source inches and exact centimeter conversions", () => {
  const apparel = products.find((product) => product.typeLabel !== "Beanie");
  const beanie = products.find((product) => product.typeLabel === "Beanie");
  assert.match(measurementGuide(apparel), /Finished garment measurements · inches \/ centimeters/);
  assert.match(measurementGuide(apparel), /Chest width<br><span aria-hidden="true">in \/ cm<\/span>/);
  assert.match(measurementGuide(apparel), /in \/ [\d.]+ cm/);
  assert.match(measurementGuide(beanie), /Unfolded height/);
  assert.doesNotMatch(measurementGuide(beanie), /head circumference/i);
});

test("recommendations favor complementary cuts and never repeat a color family", () => {
  const product = products.find((entry) => entry.slug === "insomniac-ss4500-black");
  const recommended = recommendationsFor(product, products);
  assert.ok(recommended.length >= 2);
  assert.equal(recommended[0].collection, product.collection);
  assert.notEqual(recommended[0].typeLabel, product.typeLabel);
  assert.equal(new Set(recommended.map((entry) => JSON.stringify([entry.title, entry.collection, entry.typeLabel]))).size, recommended.length);
  assert.ok(recommended.every((entry) => entry.slug !== product.slug));
});

const env = (values = {}) => ({ get: (key) => ({ AHA_SQUARE_WEBHOOK_SIGNATURE_KEY: "s".repeat(32), ...values })[key] });

test("order links are signed per order and never accept another order's token", () => {
  const url = new URL(orderStatusUrl("ORDER123456", env()));
  assert.equal(url.origin + url.pathname, "https://afterhoursagenda.com/order/");
  const token = url.searchParams.get("k");
  assert.equal(verifyOrderToken("ORDER123456", token, env()), true);
  assert.equal(verifyOrderToken("ORDER654321", token, env()), false);
  assert.equal(verifyOrderToken("ORDER123456", token, env({ AHA_ORDER_LINK_SECRET: "x".repeat(32) })), false, "a dedicated secret replaces the derived key");
  assert.equal(orderStatusUrl("ORDER123456", { get: () => undefined }), null, "no key, no link");
});

test("the order view shows progress, items and tracking, never customer details", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(await readFile(new URL("../netlify/database/migrations/20261015045000_yikes_fulfillment/migration.sql", import.meta.url), "utf8"));
  const db = { sql: async (strings, ...parameters) => (await pg.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows };
  await pg.query(`INSERT INTO aha_fulfillment_orders (square_order_id, square_payment_id, state, submitted_items, tracking, payment_created_at, apliiq_order_id) VALUES ('ORDER123456', 'PAY1', 'shipped', $1::jsonb, $2::jsonb, '2026-10-16T18:00:00Z', 'APQ-1')`, [JSON.stringify([{ title: "The City Hoodie", size: "M", quantity: 1, sku: "APQ-1" }]), JSON.stringify([{ carrier: "USPS", number: "9400", url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400" }])]);
  const url = new URL(orderStatusUrl("ORDER123456", env()));
  const response = await handleOrderStatus(new Request(url), { db, env: env() });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const view = await response.json();
  assert.deepEqual(view, { orderNumber: "ORDER123456", stage: "shipped", paidAt: "2026-10-16T18:00:00.000Z", items: [{ title: "The City Hoodie", size: "M", quantity: 1 }], tracking: [{ carrier: "USPS", number: "9400", url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400" }] });
  url.searchParams.set("k", "wrong");
  assert.equal((await handleOrderStatus(new Request(url), { db, env: env() })).status, 404);
  const unknown = new URL(orderStatusUrl("ORDER999999", env()));
  assert.equal((await (await handleOrderStatus(new Request(unknown), { db, env: env() })).json()).stage, "paid", "a valid link before the order is recorded shows Paid");
  assert.equal(stageFor({ state: "queued" }), "paid");
  assert.equal(stageFor({ state: "submitted_accepted", apliiq_order_id: "A" }), "production");
  assert.equal(stageFor({ state: "attention" }), "review");
  assert.equal(customerView("X", { submitted_items: [], tracking: [{ number: "1", url: "javascript:alert(1)" }] }).tracking[0].url, null, "only https tracking links");
});

test("the order function answers only on the exact production site", async () => {
  assert.equal(orderStatusConfig.path, "/api/orders/status");
  for (const context of [{ site: { id: "another" }, deploy: { context: "production" } }, { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "deploy-preview" } }]) {
    assert.equal((await orderStatusFunction(new Request("https://afterhoursagenda.com/api/orders/status?o=ORDER123456&k=x"), context)).status, 404);
  }
});

test("order emails carry the private order link when one can be signed", () => {
  const url = "https://afterhoursagenda.com/order/?o=ORDER123456&k=abc";
  const confirmation = renderOrderConfirmation({ orderNumber: "1001", items: [], totalAmount: 5500, currency: "USD", statusUrl: url });
  assert.match(confirmation.html, /See your order/);
  assert.ok(confirmation.html.includes("https://afterhoursagenda.com/order/?o=ORDER123456&amp;k=abc"));
  assert.match(confirmation.text, /See your order: https:\/\/afterhoursagenda\.com\/order\//);
  assert.match(renderShipment({ orderNumber: "1001", trackingNumber: "9400", statusUrl: url }).text, /See your order/);
  assert.doesNotMatch(renderOrderConfirmation({ orderNumber: "1001", items: [], totalAmount: 5500, currency: "USD", statusUrl: null }).html, /See your order/);
  assert.doesNotMatch(renderOrderConfirmation({ orderNumber: "1001", items: [], totalAmount: 5500, currency: "USD", statusUrl: "javascript:alert(1)" }).html, /See your order/);
});

test("gift cards are on unless turned off, and the footer links Square's own eGift shop", async () => {
  const { checkoutConfig } = await import("../server/checkout/runtime.mjs");
  assert.equal(checkoutConfig({ get: () => undefined }).methods.giftCard, true);
  assert.equal(checkoutConfig({ get: (key) => (key === "AHA_CHECKOUT_GIFT_CARD_ENABLED" ? "false" : undefined) }).methods.giftCard, false);
  const { brand } = await import("../src/data/site.ts");
  assert.match(brand.giftCards, /^https:\/\/app\.squareup\.com\/gift\/[A-Z0-9]+\/order$/);
});
