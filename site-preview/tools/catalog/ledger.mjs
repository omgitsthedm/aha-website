// The ledger is the single record that ties each storefront product to its
// Apliiq design and Square item. products.json stays the presentation record;
// the fulfillment allow list is generated from the ledger.
import { CatalogError, PATHS, SKU_PATTERN, readJson, skuDesignId, writeJsonAtomic } from "./lib.mjs";

export function loadLedger(file = PATHS.ledger) { return readJson(file, "catalog/ledger.json"); }
export function saveLedger(ledger, file = PATHS.ledger) { writeJsonAtomic(file, ledger); }

/** Adopt live products without creating anything (import command). */
export function ledgerFromLive({ products, fulfillment }) {
  const covered = new Set();
  const entries = products.map((product) => {
    const variants = product.variants.map((variant) => {
      const allowed = fulfillment[variant.id];
      if (!allowed) throw new CatalogError(`${product.slug}: variation ${variant.id} is missing from the fulfillment allow list.`, { code: "allowlist_missing" });
      if (allowed.sku !== variant.sku || allowed.size !== variant.size) throw new CatalogError(`${product.slug}: ${variant.id} differs between products.json and the allow list.`, { code: "allowlist_mismatch" });
      covered.add(variant.id);
      return { variationId: variant.id, size: variant.size, sku: variant.sku, priceCents: allowed.priceCents };
    });
    const designIds = [...new Set(variants.map((variant) => skuDesignId(variant.sku)))];
    if (designIds.length !== 1 || designIds[0] === null) throw new CatalogError(`${product.slug}: variants do not share one Apliiq design.`, { code: "design_mismatch" });
    const first = fulfillment[variants[0].variationId];
    return {
      slug: product.slug,
      status: "live",
      apliiq: { designId: designIds[0] },
      square: { itemId: product.squareItemId },
      fulfillment: { product: first.product, ...(first.title ? { title: first.title } : {}) },
      variants,
    };
  });
  const extra = Object.keys(fulfillment).filter((id) => !covered.has(id));
  if (extra.length) throw new CatalogError(`The allow list has ${extra.length} variation(s) with no product page.`, { code: "allowlist_orphan", details: extra });
  return { schemaVersion: 1, privateLabel: "SB-3-161622", products: entries };
}

/** Fulfillment allow-list object derived from the ledger (published products only). */
export function fulfillmentFromLedger(ledger) {
  const out = {};
  for (const entry of ledger.products) {
    if (entry.status !== "live") continue;
    for (const variant of entry.variants) {
      if (out[variant.variationId]) throw new CatalogError(`Duplicate Square variation ${variant.variationId}.`, { code: "duplicate_variation" });
      out[variant.variationId] = { sku: variant.sku, size: variant.size, priceCents: variant.priceCents, product: entry.fulfillment.product, ...(entry.fulfillment.title ? { title: entry.fulfillment.title } : {}) };
    }
  }
  return out;
}

export function validateLedger(ledger) {
  const problems = [];
  const slugs = new Set();
  for (const entry of ledger.products ?? []) {
    if (slugs.has(entry.slug)) problems.push(`${entry.slug}: duplicate slug`);
    slugs.add(entry.slug);
    for (const variant of entry.variants ?? []) {
      if (!SKU_PATTERN.test(variant.sku)) problems.push(`${entry.slug} ${variant.size}: SKU ${variant.sku} is not a decorated A1 SKU`);
      else if (skuDesignId(variant.sku) !== entry.apliiq?.designId) problems.push(`${entry.slug} ${variant.size}: SKU belongs to another design`);
      if (!Number.isSafeInteger(variant.priceCents) || variant.priceCents <= 0) problems.push(`${entry.slug} ${variant.size}: invalid price`);
    }
  }
  return problems;
}
