"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { QuickAdd } from "@/components/shop/QuickAdd";
import { ColorSwatches } from "@/components/shop/ColorSwatches";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { trackCommerceEvent } from "@/lib/analytics/events";
import type { CategoryMeta, CategorySlug, GenderSlug } from "@/lib/commerce/taxonomy";
import { CATEGORIES, getCategoryBySlug, productMatchesCategory, productMatchesGender } from "@/lib/commerce/taxonomy";
import { useInfiniteList } from "@/lib/hooks/useInfiniteScroll";
import { APPAREL_SIZE_ORDER, extractVariationSize } from "@/lib/utils/variation";

interface CategoryShopContentProps {
  products: Product[];
  gender?: GenderSlug;
  activeCategory?: CategorySlug;
  categories?: CategoryMeta[];
  basePath: string;
  /** Current page taken from `?page=N` on the server. Only read alongside `paginationPath`. */
  initialPage?: number;
  /**
   * Destination for the numbered `?page=N` links. Supplying it swaps the grid from
   * JS-only infinite scroll to crawlable pagination, so every product in the set gets
   * a real `<a>` in server HTML instead of only the first 24. The route MUST also read
   * `searchParams.page` and pass `initialPage`, or the server slice won't match the link.
   */
  paginationPath?: string;
  /** slug -> server-verified purchasable sizes for quick add */
  purchasableSizes?: Record<string, string[]>;
  /** slug -> distinct sold color count */
  colorCounts?: Record<string, number>;
  /** slug -> distinct sold color names (for swatch dots) */
  colorNames?: Record<string, string[]>;
}

const PAGE_SIZE = 24;

export function CategoryShopContent({
  products,
  gender,
  activeCategory,
  categories = CATEGORIES,
  basePath,
  initialPage = 1,
  paginationPath,
  purchasableSizes,
  colorCounts,
  colorNames,
}: CategoryShopContentProps) {
  const [activeSize, setActiveSize] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "index">("grid");
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sizeOptions = useMemo(() => {
    const available = new Set(products.flatMap((product) => product.variations.map((variation) => extractVariationSize(variation.name))));
    return APPAREL_SIZE_ORDER.filter((size) => available.has(size));
  }, [products]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const result = products.filter((product) => {
      const inCategory = !activeCategory || productMatchesCategory(product, activeCategory);
      const inSize = activeSize === "all" || product.variations.some((variation) => extractVariationSize(variation.name) === activeSize);
      const matchesSearch = !query || product.name.toLowerCase().includes(query);
      const matchesGender = !gender || productMatchesGender(product, gender);
      return inCategory && inSize && matchesSearch && matchesGender;
    });

    if (sortBy === "price-asc") return [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") return [...result].sort((a, b) => b.price - a.price);
    if (sortBy === "name") return [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [activeCategory, activeSize, products, searchTerm, sortBy, gender]);

  // Refinements the shopper set here, as opposed to the category baked into the URL —
  // a category page is still a plain browsable list, so it keeps its crawlable pages.
  const hasRefinements = activeSize !== "all" || searchTerm.trim().length > 0;
  const refinementCount = (activeSize !== "all" ? 1 : 0) + (searchTerm.trim() ? 1 : 0) + (sortBy !== "featured" ? 1 : 0);
  const usesCatalogPages = Boolean(paginationPath) && !hasRefinements && sortBy === "featured";
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), pageCount);
  const { visibleCount, hasMore: listHasMore, showLoadMore, sentinelRef, loadMore, reset } = useInfiniteList({
    pageSize: PAGE_SIZE,
    total: filtered.length,
    keySuffix: `${activeCategory ?? "all"}:${activeSize}:${sortBy}:${viewMode}:${searchTerm.trim()}`,
  });
  const visibleProducts = usesCatalogPages
    ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filtered.slice(0, visibleCount);
  const hasMore = !usesCatalogPages && listHasMore;

  const resetDiscovery = () => {
    setActiveSize("all");
    setSearchTerm("");
  };

  const control = "min-h-11 border border-border/60 bg-void px-3 py-2 text-base text-cream placeholder:text-muted transition-colors duration-200 focus:border-accent focus:outline-none";
  const toggle = "min-h-11 border px-3 text-xs font-bold uppercase tracking-[0.06em] transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.98]";

  useEffect(() => {
    if (searchTerm.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      trackCommerceEvent({ name: filtered.length ? "search" : "search_no_results", resultCount: filtered.length });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [filtered.length, searchTerm]);

  // Reset to the first page when a filter/sort/view changes — but not on the
  // initial mount, so a Back-navigation restore isn't clobbered.
  const filtersMounted = useRef(false);
  useEffect(() => {
    if (!filtersMounted.current) {
      filtersMounted.current = true;
      return;
    }
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeSize, searchTerm, sortBy, viewMode]);

  // The catalog page comes from the URL and nothing else — a grid/index toggle or a
  // temporary filter must not silently move the shopper to a page the address bar
  // disagrees with. `safePage` clamps if the filtered set shrinks under them.
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const categoryHref = (slug: string) =>
    slug === "all" ? basePath : `${basePath}/${slug}`;

  const emptyCategory = activeCategory ? getCategoryBySlug(activeCategory) : undefined;

  return (
    <section aria-label="Product catalog">
      {/* Below lg the filter block cost the whole first viewport, so the page whose
          job is showing products showed none. One control opens it; desktop is
          unchanged and always expanded.

          This trigger is a direct child of the section on purpose. A sticky box can
          only travel inside its own containing block, so nesting it in the collapsed
          filter wrapper (height ≈ the trigger itself) pinned it for zero pixels and it
          scrolled away with the first swipe. The section spans the whole grid, so the
          control stays reachable for the length of the list. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-30 border-y border-border/40 bg-void py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          className={`${toggle} flex w-full items-center justify-between gap-3 border-border/60 text-cream`}
        >
          <span>Filter &amp; sort</span>
          <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-muted">
            {/* aria-expanded already announces open/closed, so only the refinement
                count — which nothing else conveys once the panel is shut — is read out. */}
            {refinementCount > 0 ? `${refinementCount} active` : <span aria-hidden="true">{filtersOpen ? "Close" : "Open"}</span>}
          </span>
        </button>
      </div>

      <div className="mb-8 lg:border-y lg:border-border/40 lg:py-5">
        <div id="catalog-filters" className={`${filtersOpen ? "block" : "hidden"} border-b border-border/40 py-5 lg:block lg:border-b-0 lg:py-0`}>
          <div className="grid gap-4 xl:grid-cols-[minmax(15rem,1fr)_auto] xl:items-start">
            <div>
              <label htmlFor="category-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Search</label>
              <input id="category-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Product name" className={`${control} w-full`} />
            </div>
            <div className="flex flex-wrap gap-2 xl:pt-6" role="group" aria-label="Catalog view">
              {(["grid", "index"] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => setViewMode(mode)} aria-pressed={viewMode === mode} className={`${toggle} ${viewMode === mode ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"}`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Category</p>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
              <Link
                href={categoryHref("all")}
                aria-current={activeCategory === undefined ? "page" : undefined}
                className={`${toggle} inline-flex shrink-0 items-center ${activeCategory === undefined ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"}`}
              >
                All <span aria-hidden="true">{products.length}</span>
              </Link>
              {categories.map((category) => {
                const count = products.filter((p) => productMatchesCategory(p, category.slug)).length;
                if (count === 0) return null;
                return (
                  <Link
                    key={category.slug}
                    href={categoryHref(category.slug)}
                    aria-current={activeCategory === category.slug ? "page" : undefined}
                    aria-label={`${category.name}, ${count} products`}
                    className={`${toggle} inline-flex shrink-0 items-center gap-2 ${activeCategory === category.slug ? "border-accent bg-surface text-cream" : "border-border/60 text-muted hover:border-accent hover:text-cream"}`}
                  >
                    {category.name} <span aria-hidden="true">{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
            {sizeOptions.length > 0 && (
              <div>
                <label htmlFor="category-size" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Size</label>
                <select id="category-size" value={activeSize} onChange={(event) => setActiveSize(event.target.value)} className={`${control} w-full cursor-pointer`}>
                  <option value="all">All sizes</option>
                  {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>
            )}
            <div className={sizeOptions.length > 0 ? "" : "col-span-2"}>
              <label htmlFor="category-sort" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Sort</label>
              <select id="category-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={`${control} w-full cursor-pointer`}>
                <option value="featured">Featured</option>
                <option value="name">Name, A to Z</option>
                <option value="price-asc">Price, low to high</option>
                <option value="price-desc">Price, high to low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex min-h-11 flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">
        <p aria-live="polite">{filtered.length} {filtered.length === 1 ? "product" : "products"}</p>
        {/* resetDiscovery only clears size + search; the category lives in the URL. Offering
            it on an unfiltered category page was a control that did nothing. */}
        {hasRefinements && <button type="button" onClick={resetDiscovery} className="min-h-11 text-accent underline underline-offset-4">Clear filters</button>}
      </div>

      {viewMode === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {visibleProducts.map((product, index) => {
            const image = product.images[0];
            return (
              <div key={product.id} className="group paper-lift">
                <Link href={`/product/${product.slug}`} prefetch={false} className="block focus-visible:outline-offset-4">
                  <div className="fold-surface relative aspect-[3/4] overflow-hidden">
                    {image ? <ResilientImage src={image} alt={product.name} fill priority={index < 2} className={`${isPrintfulImage(image) ? "object-contain" : "object-cover"} product-art ${product.images[1] ? "transition-opacity duration-300 group-hover:opacity-0" : ""}`} sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" /> : <div className="absolute inset-0 flex items-center justify-center text-xs uppercase text-muted">Image unavailable</div>}
                    {product.images[1] && <ResilientImage src={product.images[1]} alt="" aria-hidden="true" fill className={`${isPrintfulImage(product.images[1]) ? "object-contain" : "object-cover"} product-art opacity-0 transition-opacity duration-300 group-hover:opacity-100`} sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" />}
                  </div>
                  <div className="border-b border-border/40 py-3 transition-colors group-hover:border-accent">
                    <h2 className="line-clamp-2 font-display text-lg font-bold uppercase leading-[0.95] tracking-[-0.025em] text-cream group-hover:text-accent">{product.name}</h2>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
                      <span>{product.priceFormatted}</span>
                      <ColorSwatches colors={colorNames?.[product.slug] ?? []} fallback={<span className="text-muted">{colorCounts?.[product.slug] && colorCounts[product.slug] > 1 ? `${colorCounts[product.slug]} colors` : "Made to order"}</span>} />
                    </div>
                  </div>
                </Link>
                <div className="mt-2">
                  <QuickAdd product={product} purchasableSizes={purchasableSizes?.[product.slug]} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "index" && filtered.length > 0 && (
        <div className="border-t border-border/40">
          {visibleProducts.map((product) => (
            <Link key={product.id} href={`/product/${product.slug}`} prefetch={false} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-4 border-b border-border/40 py-3 transition-colors hover:bg-surface sm:grid-cols-[1fr_12rem_auto] sm:px-3">
              <span className="font-display text-base font-black uppercase leading-tight text-cream">{product.name}</span>
              <span className="hidden text-xs uppercase tracking-[0.06em] text-muted sm:block">{product.category || "Catalog"}</span>
              <span className="font-mono text-sm font-bold text-cream">{product.priceFormatted}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Real hrefs, not JS-only reveal: without these, only the first 24 products in a
          set are linked from anywhere and the long tail is sitemap-only. `?page=N`
          already self-canonicalises to the unpaginated URL, so the index stays whole. */}
      {usesCatalogPages && pageCount > 1 && (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Catalog pages">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              href={page === 1 ? `${paginationPath}` : `${paginationPath}?page=${page}`}
              aria-current={page === safePage ? "page" : undefined}
              aria-label={`Page ${page} of ${pageCount}`}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center border px-3 text-xs font-bold ${page === safePage ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"}`}
            >
              {page}
            </Link>
          ))}
        </nav>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="mt-10 flex flex-col items-center gap-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted" aria-live="polite">
            Showing {visibleProducts.length} of {filtered.length}
          </p>
          {showLoadMore ? (
            // After a few auto-loads, hand control back so the footer is reachable.
            <button type="button" onClick={loadMore} className="min-h-12 border border-border/60 px-6 py-3 text-xs font-bold uppercase tracking-[0.06em] text-cream transition-colors hover:border-accent">
              Load more products
            </button>
          ) : (
            // Auto-loading on scroll; button is the keyboard / no-JS fallback.
            <button type="button" onClick={loadMore} aria-label="Load more products" className="inline-flex min-h-11 items-center gap-2 px-6 py-2 text-xs font-bold uppercase tracking-[0.06em] text-muted transition-colors hover:text-cream">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              Loading more
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 && hasRefinements && (
        <div className="border border-border/40 bg-surface px-5 py-16 text-center">
          <h2 className="font-display text-2xl font-black uppercase">No matches</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            {searchTerm.trim() ? <>Nothing matches “{searchTerm.trim()}”{activeSize !== "all" ? ` in size ${activeSize}` : ""}.</> : `Nothing here in size ${activeSize}.`} Try another product name, size, or category.
          </p>
          <button type="button" onClick={resetDiscovery} className="primary-action mt-6 min-h-11 px-6 py-3 text-xs">Clear filters</button>
        </div>
      )}

      {/* A category with nothing in it is not a failed search — offering "Clear filters"
          when none are set is a dead end. Say what is true and point somewhere real. */}
      {filtered.length === 0 && !hasRefinements && (
        <div className="border border-border/40 bg-surface px-5 py-16 text-center">
          <h2 className="font-display text-2xl font-black uppercase">{emptyCategory ? `No ${emptyCategory.name.toLowerCase()} yet` : "Nothing here yet"}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            {emptyCategory
              ? `We haven’t made any ${emptyCategory.name.toLowerCase()} so far. The rest of the catalog is printed to order and ready now.`
              : "This part of the catalog is empty right now. The rest is printed to order and ready now."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/shop/hoodies-sweatshirts" className={`${toggle} inline-flex items-center border-border/60 text-cream hover:border-accent`}>Hoodies &amp; sweatshirts</Link>
            <Link href="/shop/sweaters-knitwear" className={`${toggle} inline-flex items-center border-border/60 text-cream hover:border-accent`}>Sweaters &amp; knitwear</Link>
            <Link href="/shop" className={`${toggle} inline-flex items-center border-accent bg-rose text-cream`}>The whole catalog</Link>
          </div>
        </div>
      )}
    </section>
  );
}
