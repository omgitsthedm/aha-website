import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { replaceUnreleased } from "../tools/catalog/replace-unreleased.mjs";
import { createSquareClient } from "../tools/catalog/square.mjs";

const spec = { slug: "approved-tee", status: "approved", approval: { by: "Owner" }, title: "Approved Tee", color: "Ivory", priceCents: 3400, sizes: ["M"], apliiq: { productId: 1, colorId: 2, artwork: [{ key: "front", name: "Approved master", imagePath: `https://raw.githubusercontent.com/owner/repo/${"a".repeat(40)}/correct.png` }], locations: [{ id: 3, artworkKey: "front", service: "transferprint", note: "9 inches wide" }], label: { id: 6208403, placementId: 1011, placementName: "inside neck" } } };
const current = { apliiq: { designId: 10 }, square: { itemId: "old-item" } };

test("supplier replacement refuses a published page, unknown page state or ordered product before any provider write", async () => {
  for (const [pageStatus, hasOrders] of [[200, false], [503, false], [404, true]]) {
    await assert.rejects(replaceUnreleased({ spec, current, pageStatus, hasOrders, apliiq: {}, square: {} }), /confirmed unpublished|referenced by an order/);
  }
});

test("Square image retries are stable for the same request and distinct for a replacement item or changed photo", async () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "aha-image-key-")), "front.jpg");
  writeFileSync(file, "first photo");
  const keys = [];
  const square = createSquareClient({ token: "test-only", fetchImpl: async (_url, init) => { keys.push(JSON.parse(init.body.get("request")).idempotency_key); return new Response(JSON.stringify({ image: { id: "image" } }), { status: 200 }); } });
  const input = { itemId: "first-item", file, name: "Front", caption: "Approved front", isPrimary: true, idempotencyKey: "same-slug-path" };
  await square.uploadImage(input); await square.uploadImage(input);
  await square.uploadImage({ ...input, itemId: "replacement-item" });
  writeFileSync(file, "corrected photo"); await square.uploadImage(input);
  assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]); assert.notEqual(keys[0], keys[3]);
});

test("unreleased correction creates new supplier and Square variations; retries reuse confirmed intents and Square idempotency", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "aha-revision-"));
  let artworks = 0, designs = 0;
  const keys = [], oldWrites = [];
  const newItem = { type: "ITEM", id: "new-item", item_data: { name: "Approved Tee — Ivory", variations: [{ id: "new-M", item_variation_data: { name: "M", sku: "APQ-20S7A1", price_money: { amount: 3400, currency: "USD" } } }] } };
  const oldItem = { type: "ITEM", id: "old-item", version: 1, item_data: { name: "Approved Tee — Ivory", variations: [{ id: "old-M", item_variation_data: { name: "M", sku: "APQ-10S7A1" } }] } };
  const apliiq = { createArtwork: async () => { artworks++; return { Id: 30 }; }, createDesign: async (payload) => { designs++; assert.equal(payload.Subscriptions[0].Label.Id, 6208403); return { Id: 20, Variants: [{ SKU: "APQ-20S7A1" }] }; } };
  const square = { createItem: async (_object, key) => { keys.push(key); return newItem; }, readItem: async (id) => id === "new-item" ? newItem : oldItem, batchUpsert: async (objects) => { oldWrites.push(objects[0]); } };
  for (let i = 0; i < 2; i++) {
    const result = await replaceUnreleased({ spec, current, pageStatus: 404, hasOrders: false, apliiq, square, intentsDirectory: directory });
    assert.equal(result.skus.M, "APQ-20S7A1");
    assert.equal(result.variationIds.M, "new-M");
    assert.notEqual(result.itemId, current.square.itemId);
  }
  assert.equal(artworks, 1); assert.equal(designs, 1);
  assert.equal(keys[0], keys[1]);
  assert.match(oldWrites[0].item_data.name, /^\[Superseded 10\]/);
  assert.equal(oldWrites[0].item_data.variations[0].item_variation_data.sku, "APQ-10S7A1");
});
