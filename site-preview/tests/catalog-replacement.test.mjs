import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { replaceUnreleased } from "../tools/catalog/replace-unreleased.mjs";
import { createSquareClient } from "../tools/catalog/square.mjs";
import { persistReplacement, requireReplacementState, resumeReplacement } from "../tools/catalog/replacement-state.mjs";
import { writeTextAtomic } from "../tools/catalog/lib.mjs";

const spec = { slug: "approved-tee", status: "approved", approval: { by: "Owner" }, title: "Approved Tee", color: "Ivory", priceCents: 3400, sizes: ["M"], apliiq: { productId: 1, colorId: 2, artwork: [{ key: "front", name: "Approved master", imagePath: `https://raw.githubusercontent.com/owner/repo/${"a".repeat(40)}/correct.png` }], locations: [{ id: 3, artworkKey: "front", service: "transferprint", note: "9 inches wide" }], label: { id: 6208403, placementId: 1011, placementName: "inside neck" } } };
const current = { apliiq: { designId: 10 }, square: { itemId: "old-item" } };

test("replacement checks both local records and the expected identity before provider work", () => {
  const ledger = { products: [{ ...current, slug: "approved-tee" }] };
  assert.throws(() => requireReplacementState(ledger, [], "approved-tee", 10), /both ledger and presentation/);
  assert.throws(() => requireReplacementState(ledger, [{ slug: "approved-tee" }], "approved-tee", 11), /Supplier design changed/);
  assert.equal(requireReplacementState(ledger, [{ slug: "approved-tee" }], "approved-tee", 10).entry.apliiq.designId, 10);
});

test("an interrupted catalog save resumes all three artifacts without provider writes or losing another product", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aha-catalog-recovery-"));
  const paths = { ledger: path.join(dir, "ledger.json"), products: path.join(dir, "products.json"), fulfillment: path.join(dir, "catalog.mjs"), intents: path.join(dir, "intents") };
  const original = { ...current, slug: "approved-tee", status: "live", fulfillment: { product: "approved_tee" }, variants: [{ variationId: "old-M", sku: "APQ-10S7A1", size: "M", priceCents: 3400 }] };
  const next = { ...original, apliiq: { designId: 20 }, square: { itemId: "new-item" }, variants: [{ variationId: "new-M", sku: "APQ-20S7A1", size: "M", priceCents: 3400 }] };
  writeFileSync(paths.ledger, JSON.stringify({ products: [original] }));
  writeFileSync(paths.products, JSON.stringify([{ slug: "approved-tee", squareItemId: "old-item" }]));
  writeFileSync(paths.fulfillment, "old allow list");
  let writes = 0;
  const journal = { slug: "approved-tee", fromDesignId: 10, entry: next, product: { slug: "approved-tee", squareItemId: "new-item" }, summary: { apliiqDesignId: 20 } };
  assert.throws(() => persistReplacement(journal, { paths, writeText: (file, content) => { if (++writes === 2) throw Error("disk interrupted"); writeTextAtomic(file, content); } }), /disk interrupted/);
  // Unrelated catalog work after the interruption must survive recovery.
  const ledger = JSON.parse(readFileSync(paths.ledger)); ledger.products.push({ ...original, slug: "another-tee", variants: [{ ...original.variants[0], variationId: "another-M" }] }); writeFileSync(paths.ledger, JSON.stringify(ledger));
  assert.equal(resumeReplacement("approved-tee", 10, { paths }).recovered, true);
  assert.equal(JSON.parse(readFileSync(paths.ledger)).products.length, 2);
  assert.equal(JSON.parse(readFileSync(paths.products))[0].squareItemId, "new-item");
  assert.match(readFileSync(paths.fulfillment, "utf8"), /new-M/);
  assert.match(readFileSync(paths.fulfillment, "utf8"), /another-M/);
  assert.doesNotMatch(readFileSync(paths.fulfillment, "utf8"), /old-M/);
  assert.equal(resumeReplacement("approved-tee", 10, { paths }).alreadyComplete, true);
});

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
