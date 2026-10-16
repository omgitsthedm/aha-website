import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { approveDraft, callbackTokenValid, createDraftFromApliiq, getDraft, listDrafts, normalizeAddToStore, rejectDraft, searchDrafts, updateDraft } from "../server/catalog/drafts.mjs";

const migration = new URL("../netlify/database/migrations/20261016110000_product_drafts/migration.sql", import.meta.url);
const rootMigration = new URL("../../netlify/database/migrations/20261016110000_product_drafts/migration.sql", import.meta.url);

async function isolated(t) {
  const database = new PGlite(); t.after(() => database.close());
  await database.exec(await readFile(migration, "utf8"));
  const sql = async (strings, ...parameters) => (await database.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { sql };
}
const addToStore = (overrides = {}) => ({
  store_ProductId: null, shippingProfileId: null, type: "Sweatshirt", name: "Pet It Be Crewneck", currency: "USD", taxonomyId: null,
  description: "Cream ink on cranberry.", imageUrls: ["//blob.apliiq.com/sitestorage/resized-products/6300000_4546_590_900.jpg"], replaceProduct: false,
  sizes: ["S", "M"], colors: ["Cranberry"],
  variants: [{ sku: "APQ-6300000S6A1", price: 26.39, color: "Cranberry", size: "S" }, { sku: "APQ-6300000S7A1", price: 26.39, color: "Cranberry", size: "M" }],
  ...overrides,
});

test("product drafts migration is identical at both discovery paths", async () => {
  assert.equal(await readFile(migration, "utf8"), await readFile(rootMigration, "utf8"));
});

test("Add to Store accepts only decorated SKUs from one design", () => {
  assert.equal(normalizeAddToStore(addToStore()).apliiqDesignId, 6300000);
  assert.throws(() => normalizeAddToStore(addToStore({ variants: [{ sku: "APQ-6300000S6A0", size: "S", price: 1 }] })), /decorated/);
  assert.throws(() => normalizeAddToStore(addToStore({ variants: [{ sku: "APQ-6300000S6A1", size: "S", price: 1 }, { sku: "APQ-6300001S7A1", size: "M", price: 1 }] })), /one Apliiq design/);
  assert.throws(() => normalizeAddToStore(addToStore({ imageUrls: ["http://insecure.example/a.jpg"] })), /HTTPS/);
});

test("the callback token is required and compared in constant time", () => {
  const secret = "s".repeat(32);
  assert.equal(callbackTokenValid(secret, secret), true);
  assert.equal(callbackTokenValid("wrong", secret), false);
  assert.equal(callbackTokenValid(null, secret), false);
  assert.equal(callbackTokenValid("short", "short"), false);
});

test("pressing Add to Store twice refreshes one open draft", async (t) => {
  const db = await isolated(t);
  const first = await createDraftFromApliiq(db, addToStore(), { createId: () => "a" });
  const second = await createDraftFromApliiq(db, addToStore({ name: "Pet It Be Crewneck v2" }), { createId: () => "b" });
  assert.equal(first.id, second.id);
  assert.equal(second.payload_json.name, "Pet It Be Crewneck v2");
  assert.equal((await listDrafts(db, { status: "draft" })).length, 1);
  assert.deepEqual((await searchDrafts(db, "pet it")).map((hit) => hit.store_ProductId), [first.id]);
});

test("drafts move draft → approved or rejected, and only open drafts are editable", async (t) => {
  const db = await isolated(t);
  const draft = await createDraftFromApliiq(db, addToStore(), { createId: () => "c" });
  const edited = await updateDraft(db, draft.id, { title: "Pet It Be Crewneck", color: "Cranberry", priceCents: 5500, designSlug: "pet-it-be-ss3000-cranberry" });
  assert.equal(edited.payload_json.priceCents, 5500);
  assert.equal(edited.design_slug, "pet-it-be-ss3000-cranberry");
  const approved = await approveDraft(db, draft.id, { actor: "owner" });
  assert.equal(approved.status, "approved");
  await assert.rejects(updateDraft(db, draft.id, { title: "x" }), /can't be edited/);
  const rejected = await rejectDraft(db, draft.id, { actor: "owner", reason: "Wrong ink color" });
  assert.equal(rejected.status, "rejected");
  assert.equal((await getDraft(db, draft.id)).error, "Wrong ink color");
  await assert.rejects(updateDraft(db, draft.id, { designSlug: "Bad Slug" }), /lowercase/);
});

test("Add to Store answers Apliiq's registered addresses with either token, and nothing else", async () => {
  const { handleAddToStore, config } = await import("../netlify/functions/apliiq-add-to-store.mjs");
  assert.deepEqual(config.path, ["/api/apliiq/add-to-store", "/api/integrations/apliiq/products/upsert", "/api/integrations/apliiq/products/search"]);
  const current = "c".repeat(48);
  const original = "o".repeat(40);
  const env = { get: (key) => ({ APLIIQ_CALLBACK_TOKEN: current, APLIIQ_PRODUCT_CALLBACK_TOKEN: original })[key] };
  const context = { site: { id: "275b4115-16bf-42fb-9b36-6bce9bb93608" }, deploy: { context: "production" } };
  const searched = [];
  const database = () => ({ sql: async (strings, ...values) => { searched.push(values); return []; } });
  const get = (path, token) => handleAddToStore(new Request(`https://afterhoursagenda.com${path}?search=pet${token ? `&token=${token}` : ""}`), context, { env, database });
  for (const path of config.path) {
    assert.equal((await get(path)).status, 401, `${path} without a token`);
    assert.equal((await get(path, "x".repeat(48))).status, 401, `${path} with a wrong token`);
    assert.equal((await get(path, current)).status, 200, `${path} with the current token`);
    assert.equal((await get(path, original)).status, 200, `${path} with the token already registered in Apliiq`);
  }
  assert.equal((await handleAddToStore(new Request(`https://afterhoursagenda.com/api/integrations/apliiq/products/upsert?token=${original}`), { ...context, deploy: { context: "deploy-preview" } }, { env, database })).status, 404, "previews never accept callbacks");
});
