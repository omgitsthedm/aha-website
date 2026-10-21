import { familyKey, garmentGroup } from "./garments.mjs";
import { isOffSale } from "./off-sale.mjs";

/**
 * Secondary PDP suggestions should explain themselves by collection and cut,
 * never repeat color variants or pad a fixed tile quota with weak matches.
 */
export function recommendationsFor(product, products, limit = 4) {
  const currentFamily = familyKey(product);
  const currentGroup = garmentGroup(product.typeLabel);
  const score = (entry) => {
    const sameCollection = entry.collection === product.collection;
    const differentCut = garmentGroup(entry.typeLabel) !== currentGroup;
    if (sameCollection && differentCut) return 0;
    if (!sameCollection && differentCut) return 1;
    if (sameCollection) return 2;
    return 3;
  };
  const seen = new Set([currentFamily]);
  return products
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.slug !== product.slug && !isOffSale(entry.slug) && familyKey(entry) !== currentFamily)
    .sort((a, b) => score(a.entry) - score(b.entry) || a.index - b.index)
    .flatMap(({ entry }) => {
      const family = familyKey(entry);
      if (seen.has(family)) return [];
      seen.add(family);
      return [entry];
    })
    .slice(0, limit);
}
