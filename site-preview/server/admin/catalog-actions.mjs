// Admin actions on products already on sale.
// - remove: off sale everywhere at once (shop, product page, bag, feeds,
//   checkout). Paid orders still ship. The Square item is archived. Reversible.
// - restore: undoes remove.
// - deleteApliiqDesign: permanent. Only for a removed product, only when no
//   unshipped order uses the design, and only with the slug typed to confirm.
import { currentCatalog } from "../catalog/current.mjs";
import { designIdFromSku, markRestored, markRetired, noteApliiqDeleted, readRetired } from "../catalog/retired.mjs";
import { catalogStore } from "../catalog/live.mjs";
import { createApliiqGateway } from "../fulfillment/apliiq.mjs";
import { createSquareGateway } from "../fulfillment/square.mjs";

export class CatalogActionError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

const json = (value) => (typeof value === "string" ? JSON.parse(value) : value ?? []);

export function createCatalogActions({ db, env, catalog = currentCatalog, store = catalogStore, purge = async () => true, square, apliiq }) {
  const squareClient = () => square ?? createSquareGateway({ accessToken: env.get("AHA_SQUARE_ACCESS_TOKEN") });
  const apliiqClient = () => apliiq ?? createApliiqGateway({ apiKey: env.get("AHA_APLIIQ_API_KEY"), sharedSecret: env.get("AHA_APLIIQ_SHARED_SECRET") });

  async function findProduct(slug) {
    const product = (await catalog()).products.find((entry) => entry.slug === slug);
    if (!product) throw new CatalogActionError("Product not found.", 404);
    return product;
  }
  async function archive(product, archived) {
    try { await squareClient().setItemArchived(product.squareItemId, archived); return archived ? "archived" : "restored"; }
    catch (error) { return `not updated (${error?.status ? `Square ${error.status}` : "Square unavailable"})`; }
  }

  return {
    async remove(slug, { by } = {}) {
      const product = await findProduct(slug);
      await markRetired(slug, { by, store: store() });
      const squareResult = await archive(product, true);
      const purged = await purge(["catalog", `product:${slug}`]);
      return { slug, removed: true, square: squareResult, purged };
    },
    async restore(slug) {
      const product = await findProduct(slug);
      const restored = await markRestored(slug, { store: store() });
      if (!restored) throw new CatalogActionError("This product isn't removed.", 409);
      const squareResult = await archive(product, false);
      const purged = await purge(["catalog", `product:${slug}`]);
      return { slug, restored: true, square: squareResult, purged };
    },
    async deleteApliiqDesign(slug, { confirm } = {}) {
      if (confirm !== slug) throw new CatalogActionError("Type the product's slug exactly to confirm.", 422);
      const product = await findProduct(slug);
      const entry = (await readRetired(store())).products[slug];
      if (!entry) throw new CatalogActionError("Remove the product from sale first.", 409);
      const designId = designIdFromSku(product.variants[0]?.sku);
      if (!designId) throw new CatalogActionError("This product has no Apliiq design id.", 409);
      if (entry.apliiqDeletedAt) return { slug, designId, deleted: true, already: true };
      const prefix = `APQ-${designId}S`;
      const rows = await db.sql`SELECT square_order_id, submitted_items FROM aha_fulfillment_orders WHERE state <> 'shipped'`;
      const open = rows.filter((row) => json(row.submitted_items).some((item) => String(item?.sku ?? "").startsWith(prefix)));
      if (open.length) throw new CatalogActionError(`${open.length} unshipped order(s) still use this design. Delete it after they ship.`, 409);
      try { await apliiqClient().deleteDesign(designId); }
      catch (error) { throw new CatalogActionError(`Apliiq didn't delete design ${designId}${error?.status ? ` (HTTP ${error.status})` : ""}. Nothing was changed here.`, 502); }
      await noteApliiqDeleted(slug, designId, { store: store() });
      return { slug, designId, deleted: true };
    },
  };
}
