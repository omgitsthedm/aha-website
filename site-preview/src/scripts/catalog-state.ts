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

/** Hide product cards, lookbook sets and emptied collection rows (with their jump links) for products removed from sale. */
export function hideRetiredCards(retired: string[]) {
  if (!retired.length) return;
  const removed = new Set(retired);
  document.querySelectorAll<HTMLElement>("article.product-card").forEach((card) => {
    const slug = slugFromHref(card.querySelector("a")?.getAttribute("href") ?? null);
    if (slug && removed.has(slug)) card.hidden = true;
  });
  document.querySelectorAll<HTMLElement>("[data-product-set]").forEach((set) => {
    if (removed.has(set.dataset.productSet ?? "")) set.hidden = true;
  });
  // "Also in" color links on product pages.
  document.querySelectorAll<HTMLAnchorElement>("a.color-option").forEach((link) => {
    const slug = slugFromHref(link.getAttribute("href"));
    if (slug && removed.has(slug)) link.hidden = true;
  });
  document.querySelectorAll<HTMLElement>(".color-options").forEach((row) => {
    if ([...row.querySelectorAll<HTMLElement>("a.color-option")].every((link) => link.hidden)) row.hidden = true;
  });
  document.querySelectorAll<HTMLElement>(".collection-group").forEach((group) => {
    const cards = [...group.querySelectorAll<HTMLElement>("article.product-card")];
    if (!cards.length || !cards.every((card) => card.hidden)) return;
    group.hidden = true;
    const heading = group.getAttribute("aria-labelledby");
    if (heading) document.querySelectorAll<HTMLElement>(`[data-jump="${heading}"]`).forEach((link) => { link.hidden = true; });
  });
}

export const pageHasProductCards = () => Boolean(document.querySelector("article.product-card, [data-product-set]"));

// Hover devices: a product card swaps to its second view. The image is created
// on first hover, so phones and visitors who never hover download nothing extra.
if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.addEventListener("pointerover", (event) => {
    const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>(".product-card-image[data-swap-src]");
    if (!link || link.querySelector(".product-card-swap")) return;
    const main = link.querySelector("img");
    const swap = document.createElement("img");
    swap.className = "product-card-swap";
    swap.alt = "";
    swap.setAttribute("aria-hidden", "true");
    swap.decoding = "async";
    swap.sizes = main?.sizes ?? "";
    swap.srcset = link.dataset.swapSrcset ?? "";
    swap.src = link.dataset.swapSrc ?? "";
    swap.addEventListener("load", () => link.classList.add("has-swap"), { once: true });
    link.append(swap);
  }, { passive: true });
}
