import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { handleAdmin } from "../server/admin/api.mjs";
import { CatalogActionError, createCatalogActions } from "../server/admin/catalog-actions.mjs";
import { normalizeItems } from "../server/checkout/catalog.mjs";
import { currentCatalog, STATIC_PRODUCTS } from "../server/catalog/current.mjs";
import { resetLiveCatalogMemo } from "../server/catalog/live.mjs";
import { designIdFromSku, readRetired, resetRetiredMemo } from "../server/catalog/retired.mjs";
import { AHA_FULFILLMENT_CATALOG } from "../server/fulfillment/catalog.mjs";
import { handleFeeds } from "../netlify/functions/catalog-feeds.mjs";
import { handleLiveCatalog } from "../netlify/functions/catalog-live.mjs";

const PET = STATIC_PRODUCTS.find((product) => product.slug === "pet-it-be-ss3000-maroon");
const PET_DESIGN = designIdFromSku(PET.variants[0].sku);

function memoryStore() {
  const data = new Map();
  return {
    async get(key, options = {}) { if (!data.has(key)) return null; const value = data.get(key); return options.type === "json" ? JSON.parse(value) : value; },
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async set(key, value) { data.set(key, value); },
    async getMetadata(key) { return data.has(key) ? { etag: "1" } : null; },
  };
}

async function database(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of ["20261015045000_yikes_fulfillment", "20261016110000_product_drafts", "20261016120000_admin"]) await pg.exec(await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`, import.meta.url), "utf8"));
  const sql = async (strings, ...parameters) => (await pg.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), parameters)).rows;
  return { pg, db: { sql } };
}

function setup(store, overrides = {}) {
  const calls = { archived: [], deleted: [], purged: [] };
  const catalog = () => { resetRetiredMemo(); resetLiveCatalogMemo(); return currentCatalog({ store, retiredStore: store }); };
  const actions = (db) => createCatalogActions({
    db, env: { get: () => undefined }, catalog, store: () => store,
    purge: async (tags) => { calls.purged.push(tags); return true; },
    square: { setItemArchived: async (id, archived) => { calls.archived.push([id, archived]); } },
    apliiq: { deleteDesign: async (id) => { calls.deleted.push(id); return { status: 200, data: {} }; } },
    ...overrides,
  });
  return { calls, catalog, actions };
}

test("removing a product takes it off sale everywhere but keeps paid orders fulfillable", async (t) => {
  const store = memoryStore();
  const { db } = await database(t);
  const { calls, catalog, actions } = setup(store);
  const result = await actions(db).remove(PET.slug, { by: "info@afterhoursagenda.com" });
  assert.deepEqual(result, { slug: PET.slug, removed: true, square: "archived", purged: true });
  assert.deepEqual(calls.archived, [[PET.squareItemId, true]]);
  assert.deepEqual(calls.purged, [["catalog", `product:${PET.slug}`]]);

  const current = await catalog();
  assert.equal(current.saleProducts.some((product) => product.slug === PET.slug), false, "off the shop and feeds");
  assert.equal(current.products.some((product) => product.slug === PET.slug), true);
  const medium = PET.variants.find((variant) => variant.size === "M").id;
  assert.ok(current.allowList[medium], "a paid order for it still reaches Apliiq");
  assert.equal(current.saleAllowList[medium], undefined);
  assert.throws(() => normalizeItems([{ variationId: medium, quantity: 1 }], current.saleAllowList), /invalid_cart/, "checkout refuses it");
  assert.deepEqual(current.retiredVariations.sort(), PET.variants.map((variant) => variant.id).sort());

  const feed = await (await handleFeeds(new Request("https://afterhoursagenda.com/feeds/google.xml"), { deploy: { context: "production" } }, { catalog })).text();
  assert.equal(feed.includes(PET.variants[0].id), false);
  const liveJson = await (await handleLiveCatalog(new Request("https://afterhoursagenda.com/api/catalog/live"), { catalog })).json();
  assert.deepEqual(liveJson.retired, [PET.slug]);
  assert.equal(liveJson.retiredVariations.length, PET.variants.length);

  assert.deepEqual(await actions(db).restore(PET.slug), { slug: PET.slug, restored: true, square: "restored", purged: true });
  assert.deepEqual(calls.archived.at(-1), [PET.squareItemId, false]);
  assert.equal((await catalog()).saleProducts.some((product) => product.slug === PET.slug), true);
  await assert.rejects(actions(db).restore(PET.slug), /isn't removed/);
});

test("a Square failure doesn't block removal; it is reported", async (t) => {
  const store = memoryStore();
  const { db } = await database(t);
  const { actions } = setup(store, { square: { setItemArchived: async () => { const error = new Error("x"); error.status = 503; throw error; } } });
  assert.equal((await actions(db).remove(PET.slug)).square, "not updated (Square 503)");
  assert.ok((await readRetired(store)).products[PET.slug]);
});

test("deleting the Apliiq design is guarded: removed first, slug typed, no unshipped orders", async (t) => {
  const store = memoryStore();
  const { db, pg } = await database(t);
  const { calls, actions } = setup(store);
  await assert.rejects(actions(db).deleteApliiqDesign(PET.slug, { confirm: "nope" }), (error) => error instanceof CatalogActionError && error.status === 422);
  await assert.rejects(actions(db).deleteApliiqDesign(PET.slug, { confirm: PET.slug }), /Remove the product from sale first/);
  await actions(db).remove(PET.slug);
  await pg.query(`INSERT INTO aha_fulfillment_orders (square_order_id, square_payment_id, state, submitted_items) VALUES ('O-1', 'P-1', 'queued', $1::jsonb)`, [JSON.stringify([{ sku: PET.variants[2].sku, quantity: 1 }])]);
  await assert.rejects(actions(db).deleteApliiqDesign(PET.slug, { confirm: PET.slug }), /1 unshipped order\(s\) still use this design/);
  assert.deepEqual(calls.deleted, []);
  await pg.query(`UPDATE aha_fulfillment_orders SET state = 'shipped'`);
  assert.deepEqual(await actions(db).deleteApliiqDesign(PET.slug, { confirm: PET.slug }), { slug: PET.slug, designId: PET_DESIGN, deleted: true });
  assert.deepEqual(calls.deleted, [PET_DESIGN]);
  assert.ok((await readRetired(store)).products[PET.slug].apliiqDeletedAt);
  assert.equal((await actions(db).deleteApliiqDesign(PET.slug, { confirm: PET.slug })).already, true, "a second click never calls Apliiq again");
  assert.deepEqual(calls.deleted, [PET_DESIGN]);
});

test("an Apliiq refusal changes nothing here", async (t) => {
  const store = memoryStore();
  const { db } = await database(t);
  const { actions } = setup(store, { apliiq: { deleteDesign: async () => { const error = new Error("x"); error.status = 500; throw error; } } });
  await actions(db).remove(PET.slug);
  await assert.rejects(actions(db).deleteApliiqDesign(PET.slug, { confirm: PET.slug }), (error) => error.status === 502 && /HTTP 500/.test(error.message));
  assert.equal((await readRetired(store)).products[PET.slug].apliiqDeletedAt, undefined);
});

test("product actions need a signed-in, same-origin admin and are audited", async (t) => {
  const { db, pg } = await database(t);
  const env = { get: (key) => ({ ADMIN_ORIGIN: "https://afterhoursagenda.com" })[key] };
  const done = [];
  const actions = { remove: async (slug, { by }) => { done.push([slug, by]); return { slug, removed: true }; }, restore: async () => ({}), deleteApliiqDesign: async () => ({}) };
  const call = (headers) => handleAdmin(new Request(`https://afterhoursagenda.com/api/admin/catalog/${PET.slug}/remove`, { method: "POST", body: "{}", headers }), { db, env, context: { ip: "203.0.113.9" }, actions });
  assert.equal((await call({ origin: "https://afterhoursagenda.com", "x-aha-admin": "1" })).status, 401);
  await pg.query(`INSERT INTO aha_admin_users (id, email) VALUES ('adm_1', 'info@afterhoursagenda.com')`);
  const { createHash } = await import("node:crypto");
  await pg.query(`INSERT INTO aha_admin_sessions (token_sha256, user_id, expires_at) VALUES ($1, 'adm_1', now() + interval '1 hour')`, [createHash("sha256").update("tok").digest("hex")]);
  assert.equal((await call({ cookie: "__Host-aha_admin=tok" })).status, 403, "cross-site requests are refused");
  const ok = await call({ cookie: "__Host-aha_admin=tok", origin: "https://afterhoursagenda.com", "x-aha-admin": "1" });
  assert.equal(ok.status, 200);
  assert.deepEqual(done, [[PET.slug, "info@afterhoursagenda.com"]]);
  const [audit] = (await pg.query(`SELECT action, target FROM aha_admin_audit WHERE action = 'catalog.remove'`)).rows;
  assert.deepEqual(audit, { action: "catalog.remove", target: PET.slug });
});

test("the allow list given to fulfillment still holds every built variation", () => {
  assert.ok(Object.keys(AHA_FULFILLMENT_CATALOG).length >= 109);
});
