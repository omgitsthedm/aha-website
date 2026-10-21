export type SearchSurface = "menu" | "shop";

const aliases: Record<string, string[]> = {
  sweatshirt: ["sweatshirt", "crewneck", "hoodie"],
  crewneck: ["crewneck", "sweatshirt"],
  hoodie: ["hoodie", "sweatshirt"],
  longsleeve: ["long sleeve"],
  tee: ["tee", "t shirt"],
};

export const normalizeSearch = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const searchTerms = (value: string) => normalizeSearch(value).replace(/\bt\s+shirt\b/g, "tee").split(/\s+/).filter(Boolean);
export const searchVariants = (term: string) => aliases[term] ?? [term];
export const matchesSearch = (value: string, query: string) => {
  const haystack = normalizeSearch(value);
  return searchTerms(query).every((term) => searchVariants(term).some((variant) => haystack.includes(normalizeSearch(variant))));
};

export function searchEventDispatcher(surface: SearchSurface) {
  let timer = 0;
  return (query: string, resultCount: number) => {
    window.clearTimeout(timer);
    const terms = searchTerms(query);
    if (!terms.length) return;
    const queryKind = terms.some((term) => term in aliases || ["beanie", "beanies", "shirt", "jacket", "fleece"].includes(term)) ? "garment" : "other";
    timer = window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent("aha:search", { detail: { surface, result_count: resultCount, query_kind: queryKind } }));
    }, 600);
  };
}
