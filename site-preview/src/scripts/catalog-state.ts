// What changed in the catalog since this page was built: products published
// live (cards and bag sizes) and products removed from sale in the admin.
// One small CDN-cached request per page, made only when the page needs it.
export type CatalogState = {
  products: Array<{ slug: string; collection: string; card: string }>;
  cartLines: Array<Record<string, unknown>>;
  retired: string[];
  retiredVariations: string[];
};

const EMPTY: CatalogState = { products: [], cartLines: [], retired: [], retiredVariations: [] };
let pending: Promise<CatalogState> | null = null;

export function catalogState(): Promise<CatalogState> {
  pending ??= fetch("/api/catalog/live", { headers: { accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : EMPTY))
    .then((data: Partial<CatalogState>) => ({ ...EMPTY, ...data }))
    .catch(() => EMPTY);
  return pending;
}

const slugFromHref = (href: string | null) => /^\/shop\/([a-z0-9-]+)\/$/.exec(href ?? "")?.[1] ?? null;

/** Hide product cards (and emptied collection rows) for products removed from sale. */
export function hideRetiredCards(retired: string[]) {
  if (!retired.length) return;
  const removed = new Set(retired);
  document.querySelectorAll<HTMLElement>("article.product-card").forEach((card) => {
    const slug = slugFromHref(card.querySelector("a")?.getAttribute("href") ?? null);
    if (slug && removed.has(slug)) card.hidden = true;
  });
  document.querySelectorAll<HTMLElement>(".collection-group").forEach((group) => {
    const cards = [...group.querySelectorAll<HTMLElement>("article.product-card")];
    if (cards.length && cards.every((card) => card.hidden)) group.hidden = true;
  });
}

export const pageHasProductCards = () => Boolean(document.querySelector("article.product-card"));
