import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  capsuleSeoDescription,
  contentFingerprint,
  contentIdempotencyKey,
  convergeSquareCommerceObject,
  expectedSquareCommerce,
  mergeCapsuleManifestRow,
  prepareSquareCreateCheckpoint,
  stableStringify,
  validateSquareMapping,
} from "@/scripts/square-capsule.mjs";

const product = { slug: "test-tee", title: "Test", productType: "tee", retailPrice: 4000 };
const mapping = { itemId: "ITEM", variations: { S: "VAR-S", "2XL": "VAR-2XL" } };
const commerce = expectedSquareCommerce(product, ["S", "2XL"]);
const item = {
  type: "ITEM",
  id: "ITEM",
  version: 7,
  present_at_all_locations: true,
  item_data: {
    name: "Test — Tee",
    product_type: "REGULAR",
    is_taxable: true,
    variations: [
      {
        type: "ITEM_VARIATION", id: "VAR-S", present_at_all_locations: true,
        item_variation_data: {
          item_id: "ITEM", name: "S", sku: "AHA-TEST-TEE-S", pricing_type: "FIXED_PRICING",
          price_money: { amount: 4000, currency: "USD" }, track_inventory: false,
        },
      },
      {
        type: "ITEM_VARIATION", id: "VAR-2XL", present_at_all_locations: true,
        item_variation_data: {
          item_id: "ITEM", name: "2XL", sku: "AHA-TEST-TEE-2XL", pricing_type: "FIXED_PRICING",
          price_money: { amount: 4000, currency: "USD" }, track_inventory: false,
        },
      },
    ],
  },
};

describe("Square capsule live commerce convergence", () => {
  it("accepts every expected live item and variation commerce field", () => {
    expect(validateSquareMapping("test-tee", mapping, ["S", "2XL"], item, commerce)).toBe(item);
  });

  it.each([
    ["stale item", { ...item, id: "OTHER" }, /stale or does not resolve/],
    ["missing variation", { ...item, item_data: { ...item.item_data, variations: item.item_data.variations.slice(0, 1) } }, /VAR-2XL is stale or missing/],
    ["wrong parent", { ...item, item_data: { ...item.item_data, variations: [item.item_data.variations[0], { ...item.item_data.variations[1], item_variation_data: { ...item.item_data.variations[1].item_variation_data, item_id: "OTHER" } }] } }, /does not belong/],
  ])("fails closed on a %s mapping", (_label, providerItem, expected) => {
    expect(() => validateSquareMapping("test-tee", mapping, ["S", "2XL"], providerItem, commerce)).toThrow(expected);
  });

  it("converges stale live SKU and price, while strict validation rejects them before convergence", () => {
    const stale = structuredClone(item);
    stale.item_data.variations[0].item_variation_data.sku = "OLD-SKU";
    stale.item_data.variations[0].item_variation_data.price_money.amount = 9999;
    expect(() => validateSquareMapping("test-tee", mapping, ["S", "2XL"], stale, commerce)).toThrow(/SKU is stale/);

    const converged = convergeSquareCommerceObject("test-tee", mapping, ["S", "2XL"], stale, commerce);
    expect(converged.version).toBe(7);
    expect(converged.item_data.variations[0].item_variation_data).toMatchObject({
      sku: "AHA-TEST-TEE-S",
      pricing_type: "FIXED_PRICING",
      price_money: { amount: 4000, currency: "USD" },
      track_inventory: false,
    });
    expect(validateSquareMapping("test-tee", mapping, ["S", "2XL"], converged, commerce)).toBe(converged);
  });

  it.each([
    ["item name", (value: typeof item) => { value.item_data.name = "Old"; }, /item name is stale/],
    ["taxability", (value: typeof item) => { value.item_data.is_taxable = false; }, /taxability is stale/],
    ["variation name", (value: typeof item) => { value.item_data.variations[0].item_variation_data.name = "Small"; }, /variation name is stale/],
    ["currency", (value: typeof item) => { value.item_data.variations[0].item_variation_data.price_money.currency = "CAD"; }, /fixed USD price is stale/],
    ["inventory", (value: typeof item) => { value.item_data.variations[0].item_variation_data.track_inventory = true; }, /inventory setting is stale/],
    ["live presence", (value: typeof item) => { value.item_data.variations[0].present_at_all_locations = false; }, /live presence is stale/],
  ])("does not allow stale %s to pass provider verification", (_label, mutate, expected) => {
    const stale = structuredClone(item);
    mutate(stale);
    expect(() => validateSquareMapping("test-tee", mapping, ["S", "2XL"], stale, commerce)).toThrow(expected);
  });

  it("rejects unexpected and non-normalized saved size mappings", () => {
    expect(() => validateSquareMapping("test-tee", { ...mapping, variations: { ...mapping.variations, M: "VAR-M" } }, ["S", "2XL"], item, commerce))
      .toThrow(/unexpected Square variation size/);
    expect(() => validateSquareMapping("test-tee", { itemId: "ITEM", variations: { S: "VAR-S", XXL: "VAR-2XL" } }, ["S", "2XL"], item, commerce))
      .toThrow(/must use normalized size 2XL/);
  });
});

describe("Square capsule create checkpoint", () => {
  const directories: string[] = [];
  afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

  function checkpointPath() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "square-capsule-"));
    directories.push(directory);
    return path.join(directory, "pending", "test-tee.json");
  }

  it("atomically persists a fingerprint and reuses the same key for an unchanged recent retry", () => {
    const file = checkpointPath();
    const requestFingerprint = contentFingerprint({ batches: [{ objects: ["same"] }] });
    const idempotencyKey = contentIdempotencyKey("capsule-item", { requestFingerprint });
    const first = prepareSquareCreateCheckpoint(file, { slug: "test-tee", requestFingerprint, idempotencyKey }, new Date("2026-08-19T10:00:00Z"));
    const retry = prepareSquareCreateCheckpoint(file, { slug: "test-tee", requestFingerprint, idempotencyKey }, new Date("2026-08-19T10:05:00Z"));
    expect(retry).toEqual(first);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(first);
  });

  it("fails closed when source changes while a create is pending", () => {
    const file = checkpointPath();
    const details = { slug: "test-tee", requestFingerprint: "first", idempotencyKey: "same-key" };
    prepareSquareCreateCheckpoint(file, details, new Date("2026-08-19T10:00:00Z"));
    expect(() => prepareSquareCreateCheckpoint(file, { ...details, requestFingerprint: "changed" }, new Date("2026-08-19T10:01:00Z")))
      .toThrow(/source changed.*reconcile/i);
  });

  it("requires provider reconciliation for old or legacy ambiguous checkpoints", () => {
    const old = checkpointPath();
    const details = { slug: "test-tee", requestFingerprint: "first", idempotencyKey: "same-key" };
    prepareSquareCreateCheckpoint(old, details, new Date("2026-08-19T10:00:00Z"));
    expect(() => prepareSquareCreateCheckpoint(old, details, new Date("2026-08-20T10:00:00Z")))
      .toThrow(/outside the safe idempotency retry window.*reconcile/i);

    const legacy = checkpointPath();
    fs.mkdirSync(path.dirname(legacy), { recursive: true });
    fs.writeFileSync(legacy, JSON.stringify({ slug: "test-tee", idempotencyKey: "old" }));
    expect(() => prepareSquareCreateCheckpoint(legacy, details, new Date("2026-08-19T10:00:00Z")))
      .toThrow(/legacy or ambiguous.*reconciliation/i);
  });
});

describe("Square capsule merchandising preservation", () => {
  it("preserves curated fields and extra gallery images when republishing", () => {
    const existing = {
      slug: "test-tee", title: "Old", badges: ["Limited"], sortPriority: 99,
      collectionIds: ["editorial"], gender: ["unisex"], fitDescription: "Curated fit.",
      careInstructions: "Hand wash.", productionNote: "Ships after launch.", shippingNote: "Curated shipping.",
      returnsNote: "Final sale.", lifestyleImage: "/campaign/custom.jpg", dropMetadata: { wave: 2 },
      launchDate: "2026-09-01", galleryImages: ["/products/test-tee/front.jpg", "/products/test-tee/lifestyle.jpg"],
    };
    const generated = {
      slug: "test-tee", title: "New", badges: [], sortPriority: 0, collectionIds: ["capsule-2026"],
      gender: ["men", "women", "unisex"], fitDescription: "Default", careInstructions: "Default",
      productionNote: "Default", shippingNote: "Default", returnsNote: "Default",
      galleryImages: ["/products/test-tee/front.jpg", "/products/test-tee/detail.jpg", "/products/test-tee/art.jpg"],
    };
    expect(mergeCapsuleManifestRow(existing, generated)).toMatchObject({
      title: "New", badges: ["Limited"], sortPriority: 99, collectionIds: ["editorial"], gender: ["unisex"],
      fitDescription: "Curated fit.", careInstructions: "Hand wash.", productionNote: "Ships after launch.",
      shippingNote: "Curated shipping.", returnsNote: "Final sale.", lifestyleImage: "/campaign/custom.jpg",
      dropMetadata: { wave: 2 }, launchDate: "2026-09-01",
      galleryImages: ["/products/test-tee/front.jpg", "/products/test-tee/detail.jpg", "/products/test-tee/art.jpg", "/products/test-tee/lifestyle.jpg"],
    });
  });

  it("uses generated defaults for a new manifest row", () => {
    const generated = { slug: "new", badges: [], sortPriority: 0, galleryImages: ["front.jpg"] };
    expect(mergeCapsuleManifestRow(undefined, generated)).toBe(generated);
  });
});

describe("Square capsule content idempotency", () => {
  it("uses the same bounded key for semantically identical request content", () => {
    const first = contentIdempotencyKey("capsule-item", { title: "Test", sizes: ["S", "M"], price: 4000 });
    const reordered = contentIdempotencyKey("capsule-item", { price: 4000, sizes: ["S", "M"], title: "Test" });
    expect(first).toBe(reordered);
    expect(first.length).toBeLessThanOrEqual(45);
  });

  it("changes the key when product or image content changes", () => {
    const original = contentIdempotencyKey("capsule-image", { itemId: "ITEM", digest: "aaa" });
    expect(contentIdempotencyKey("capsule-image", { itemId: "ITEM", digest: "bbb" })).not.toBe(original);
    expect(contentIdempotencyKey("capsule-image", { itemId: "OTHER", digest: "aaa" })).not.toBe(original);
  });

  it("canonicalizes nested object keys without reordering arrays", () => {
    expect(stableStringify({ z: { b: 2, a: 1 }, a: ["M", "S"] })).toBe('{"a":["M","S"],"z":{"a":1,"b":2}}');
  });

  it("uses the canonical no-city made-to-order SEO copy", () => {
    expect(capsuleSeoDescription("Test Tee")).toBe("Test Tee. Made to order.");
    expect(capsuleSeoDescription("Test Tee")).not.toMatch(/NYC|New York/i);
  });
});
