// Durable local completion after provider writes. A restart finishes the same
// correction without submitting another supplier design or overwriting other products.
import { existsSync } from "node:fs";
import path from "node:path";
import { CatalogError, PATHS, readJson, writeJsonAtomic, writeTextAtomic } from "./lib.mjs";
import { renderFulfillmentCatalog } from "./generate.mjs";

export function requireReplacementState(ledger, products, slug, fromDesignId) {
  const entry = ledger.products.find((p) => p.slug === slug);
  const product = products.find((p) => p.slug === slug);
  if (!entry || !product) throw new CatalogError("Replacement requires both ledger and presentation records before any provider write.", { code: "replacement_missing_page" });
  if (String(entry.apliiq.designId) !== String(fromDesignId)) throw new CatalogError("Supplier design changed; inspect before replacement.", { code: "replacement_changed" });
  return { entry, product };
}

const fileFor = (slug, from, paths) => {
  if (!/^[a-z0-9-]+$/.test(slug) || !/^\d+$/.test(String(from))) throw new CatalogError("Invalid replacement journal identity.", { code: "replacement_arguments" });
  return path.join(paths.intents, `replacement-state-${slug}-${from}.json`);
};

function finish(journal, file, paths, writeText = writeTextAtomic) {
  const ledger = readJson(paths.ledger), products = readJson(paths.products);
  const index = ledger.products.findIndex((p) => p.slug === journal.slug);
  const page = products.findIndex((p) => p.slug === journal.slug);
  const allowed = [String(journal.fromDesignId), String(journal.entry.apliiq.designId)];
  if (index < 0 || page < 0 || !allowed.includes(String(ledger.products[index].apliiq.designId))) throw new CatalogError("Pending correction conflicts with current local state; no records changed.", { code: "replacement_recovery_conflict" });
  ledger.products[index] = journal.entry;
  products[page] = journal.product;
  // Prepare all three artifacts before writing any. The journal survives a
  // process interruption between renames; replay merges only this product.
  const outputs = [[paths.ledger, JSON.stringify(ledger, null, 2) + "\n"], [paths.products, JSON.stringify(products, null, 2) + "\n"], [paths.fulfillment, renderFulfillmentCatalog(ledger)]];
  for (const [target, content] of outputs) writeText(target, content);
  writeJsonAtomic(file, { ...journal, state: "complete", completedAt: new Date().toISOString() });
  return journal.summary;
}

export function resumeReplacement(slug, fromDesignId, { paths = PATHS, writeText } = {}) {
  const file = fileFor(slug, fromDesignId, paths);
  if (!existsSync(file)) return null;
  const journal = readJson(file);
  if (journal.state === "complete") return { ...journal.summary, alreadyComplete: true };
  return { ...finish(journal, file, paths, writeText), recovered: true };
}

export function persistReplacement(journal, { paths = PATHS, writeText } = {}) {
  const file = fileFor(journal.slug, journal.fromDesignId, paths);
  writeJsonAtomic(file, { ...journal, state: "pending", createdAt: new Date().toISOString() });
  return finish(journal, file, paths, writeText);
}
