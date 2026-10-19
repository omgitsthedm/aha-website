// A supplier correction before first publication must create new decorated SKUs,
// never silently point an existing Square variation at a different design.
import { CatalogError, confirmedArtworkId, expectedSku, sha256 } from "./lib.mjs";
import { designPayload, withIntent } from "./apliiq.mjs";
import { itemObject, squareIdempotencyKey, verifyItem } from "./square.mjs";

export async function replaceUnreleased({ spec, current, apliiq, square, pageStatus, hasOrders, intentsDirectory }) {
  if (pageStatus !== 404) throw new CatalogError("Replacement requires a confirmed unpublished (404) product page.", { code: "replacement_published" });
  if (hasOrders) throw new CatalogError("A product referenced by an order cannot use the unreleased replacement path.", { code: "replacement_ordered" });
  if (spec.status !== "approved" || !spec.approval?.by) throw new CatalogError("Replacement requires the approved design specification.", { code: "replacement_unapproved" });
  const revision = sha256({ artwork: spec.apliiq.artwork, locations: spec.apliiq.locations, note: spec.apliiq.productionNote }).slice(0, 16);
  const artworkIds = {};
  for (const art of spec.apliiq.artwork) {
    const known = art.id ?? confirmedArtworkId(art.imagePath, intentsDirectory);
    artworkIds[art.key] = known ?? (await withIntent(`revision-artwork-${spec.slug}-${revision}-${art.key}`, { Name: art.name, ImagePath: art.imagePath }, apliiq.createArtwork, intentsDirectory ? { directory: intentsDirectory } : {})).Id;
  }
  const design = await withIntent(`revision-design-${spec.slug}-${revision}`, designPayload(spec, artworkIds), apliiq.createDesign, intentsDirectory ? { directory: intentsDirectory } : {});
  const skus = Object.fromEntries(spec.sizes.map((size) => [size, expectedSku(design.Id, size, spec.apliiq.sizeCodes)]));
  for (const sku of Object.values(skus)) if (!(design.Variants ?? []).some((v) => v.SKU === sku)) throw new CatalogError("Corrected supplier design omitted an expected decorated SKU.", { code: "apliiq_sku_missing" });
  const made = await square.createItem(itemObject(spec, skus), squareIdempotencyKey(spec, skus));
  const item = await square.readItem(made.id);
  const variationIds = verifyItem(spec, skus, item);
  const oldItem = await square.readItem(current.square.itemId);
  await square.batchUpsert([{ ...oldItem, item_data: { ...oldItem.item_data, name: `[Superseded ${current.apliiq.designId}] ${spec.title} — ${spec.color}` } }], `aha-supersede-${current.square.itemId}-${revision}`);
  return { revision, designId: design.Id, artworkIds, itemId: item.id, variationIds, skus };
}
