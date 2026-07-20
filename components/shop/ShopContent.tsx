"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { QuickAdd } from "@/components/shop/QuickAdd";
import { ColorSwatches } from "@/components/shop/ColorSwatches";
import Link from "next/link";
import type { Collection, Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { trackCommerceEvent } from "@/lib/analytics/events";
import { useInfiniteList } from "@/lib/hooks/useInfiniteScroll";

interface ShopContentProps {
  products: Product[];
  collections: Collection[];
  initialPage?: number;
  paginationPath?: string;
  /** slug -> server-verified purchasable sizes for quick add */
  purchasableSizes?: Record<string, string[]>;
  /** slug -> distinct sold color count */
  colorCounts?: Record<string, number>;
  colorNames?: Record<string, string[]>;
}

const APPAREL_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const PAGE_SIZE = 24;
const variationSize = (name: string) => name.split("/").pop()?.trim().toUpperCase() || name.toUpperCase();

export function ShopContent({ products, collections, initialPage = 1, paginationPath, purchasableSizes, colorCounts, colorNames }: ShopContentProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeSize, setActiveSize] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "index">("grid");
  const [currentPage, setCurrentPage] = useState(initialPage);

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => product.collectionIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
    return counts;
  }, [products]);

  const sizeOptions = useMemo(() => {
    const available = new Set(products.flatMap((product) => product.variations.map((variation) => variationSize(variation.name))));
    return APPAREL_SIZE_ORDER.filter((size) => available.has(size));
  }, [products]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const result = products.filter((product) => {
      const inCollection = activeFilter === "all" || product.collectionIds.includes(activeFilter);
      const inSize = activeSize === "all" || product.variations.some((variation) => variationSize(variation.name) === activeSize);
      const matchesSearch = !query || product.name.toLowerCase().includes(query);
      return inCollection && inSize && matchesSearch;
    });

    if (sortBy === "price-asc") return [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") return [...result].sort((a, b) => b.price - a.price);
    if (sortBy === "name") return [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [activeFilter, activeSize, products, searchTerm, sortBy]);
  const hasActiveDiscovery = activeFilter !== "all" || activeSize !== "all" || searchTerm.trim().length > 0;
  const usesCatalogPages = Boolean(paginationPath) && !hasActiveDiscovery && sortBy === "featured";
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const { visibleCount, hasMore: listHasMore, showLoadMore, sentinelRef, loadMore, reset } = useInfiniteList({
    pageSize: PAGE_SIZE,
    total: filtered.length,
    keySuffix: `${activeFilter}:${activeSize}:${sortBy}:${viewMode}:${searchTerm.trim()}`,
  });
  const visibleProducts = usesCatalogPages
    ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filtered.slice(0, visibleCount);
  const hasMore = !usesCatalogPages && listHasMore;

  const resetDiscovery = () => {
    setActiveFilter("all");
    setActiveSize("all");
    setSearchTerm("");
  };

  const collectionFor = (product: Product) => collections.find((collection) => product.collectionIds.includes(collection.id));
  const control = "min-h-11 border border-border/60 bg-void px-3 py-2 text-sm text-cream placeholder:text-muted transition-colors duration-200 focus:border-accent focus:outline-none";
  const toggle = "min-h-11 border px-3 text-xs font-bold uppercase tracking-[0.06em] transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.98]";

  useEffect(() => {
    if (searchTerm.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      trackCommerceEvent({ name: filtered.length ? "search" : "search_no_results", resultCount: filtered.length });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [filtered.length, searchTerm]);

  // Reset to page one when a filter/sort/view changes — skip the initial mount so
  // a Back-navigation restore isn't clobbered.
  const filtersMounted = useRef(false);
  useEffect(() => {
    if (!filtersMounted.current) {
      filtersMounted.current = true;
      return;
    }
    reset();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, activeSize, searchTerm, sortBy, viewMode]);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  return (
    <section aria-label="Product catalog">
      <div className="mb-8 border-y border-border/40 py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(15rem,1fr)_auto] xl:items-start">
          <div>
            <label htmlFor="shop-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Search</label>
            <input id="shop-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Product name" className={`${control} w-full`} />
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
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Collection</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by collection">
            <button type="button" onClick={() => setActiveFilter("all")} aria-pressed={activeFilter === "all"} className={`${toggle} ${activeFilter === "all" ? "border-accent bg-rose text-cream" : "border-border/60 text-cream hover:border-accent"}`}>All <span aria-hidden="true">{products.length}</span></button>
            {collections.filter((collection) => collectionCounts.get(collection.id)).map((collection) => (
              <button key={collection.id} type="button" onClick={() => setActiveFilter(collection.id)} aria-pressed={activeFilter === collection.id} aria-label={`${collection.name}, ${collectionCounts.get(collection.id)} products`} className={`${toggle} inline-flex items-center gap-2 ${activeFilter === collection.id ? "border-accent bg-surface text-cream" : "border-border/60 text-muted hover:border-accent hover:text-cream"}`}>
                {collection.name} <span aria-hidden="true">{collectionCounts.get(collection.id)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {sizeOptions.length > 0 && (
            <div>
              <label htmlFor="shop-size" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Size</label>
              <select id="shop-size" value={activeSize} onChange={(event) => setActiveSize(event.target.value)} className={`${control} w-full cursor-pointer`}>
                <option value="all">All sizes</option>
                {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="shop-sort" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Sort</label>
            <select id="shop-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={`${control} w-full cursor-pointer`}>
              <option value="featured">Catalog order</option>
              <option value="name">Name, A to Z</option>
              <option value="price-asc">Price, low to high</option>
              <option value="price-desc">Price, high to low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6 flex min-h-11 flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">
        <p aria-live="polite">{filtered.length} {filtered.length === 1 ? "product" : "products"}</p>
        {hasActiveDiscovery && <button type="button" onClick={resetDiscovery} className="min-h-11 text-accent underline underline-offset-4">Clear filters</button>}
      </div>

      {viewMode === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {visibleProducts.map((product, index) => {
            const image = product.images[0];
            const collection = collectionFor(product);
            return (
              <div key={product.id} className="group paper-lift">
                <Link href={`/product/${product.slug}`} className="block focus-visible:outline-offset-4">
                  <div className="fold-surface relative aspect-[3/4] overflow-hidden">
                    {image ? <Image src={image} alt={product.name} fill priority={index < 4} className={`${isPrintfulImage(image) ? "object-contain" : "object-cover"} product-art ${product.images[1] ? "transition-opacity duration-300 group-hover:opacity-0" : ""}`} sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" /> : <div className="absolute inset-0 flex items-center justify-center text-xs uppercase text-muted">Image unavailable</div>}
                    {product.images[1] && <Image src={product.images[1]} alt="" aria-hidden="true" fill className={`${isPrintfulImage(product.images[1]) ? "object-contain" : "object-cover"} product-art opacity-0 transition-opacity duration-300 group-hover:opacity-100`} sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" />}
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
          {visibleProducts.map((product) => {
            const collection = collectionFor(product);
            return (
              <Link key={product.id} href={`/product/${product.slug}`} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-4 border-b border-border/40 py-3 transition-colors hover:bg-surface sm:grid-cols-[1fr_12rem_auto] sm:px-3">
                <span className="font-display text-base font-black uppercase leading-tight text-cream">{product.name}</span>
                <span className="hidden text-xs uppercase tracking-[0.06em] text-muted sm:block">{collection?.name || "Catalog"}</span>
                <span className="font-mono text-sm font-bold text-cream">{product.priceFormatted}</span>
              </Link>
            );
          })}
        </div>
      )}

      {usesCatalogPages && pageCount > 1 && (
        <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Catalog pages">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              href={`${paginationPath}?page=${page}`}
              aria-current={page === safePage ? "page" : undefined}
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

      {filtered.length === 0 && (
        <div className="border border-border/40 bg-surface px-5 py-16 text-center">
          <h2 className="font-display text-2xl font-black uppercase">No matches</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">Try another product name, size, or collection.</p>
          <button type="button" onClick={resetDiscovery} className="primary-action mt-6 min-h-11 px-6 py-3 text-xs">Clear filters</button>
        </div>
      )}
    </section>
  );
}
