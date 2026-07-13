"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { trackCommerceEvent } from "@/lib/analytics/events";
import type { CategoryMeta, CategorySlug, GenderSlug } from "@/lib/commerce/taxonomy";
import { CATEGORIES, productMatchesCategory, productMatchesGender } from "@/lib/commerce/taxonomy";

interface CategoryShopContentProps {
  products: Product[];
  gender?: GenderSlug;
  activeCategory?: CategorySlug;
  categories?: CategoryMeta[];
  basePath: string;
}

const APPAREL_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const PAGE_SIZE = 24;
const variationSize = (name: string) => name.split("/").pop()?.trim().toUpperCase() || name.toUpperCase();

export function CategoryShopContent({
  products,
  gender,
  activeCategory,
  categories = CATEGORIES,
  basePath,
}: CategoryShopContentProps) {
  const [activeSize, setActiveSize] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "index">("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sizeOptions = useMemo(() => {
    const available = new Set(products.flatMap((product) => product.variations.map((variation) => variationSize(variation.name))));
    return APPAREL_SIZE_ORDER.filter((size) => available.has(size));
  }, [products]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const result = products.filter((product) => {
      const inCategory = !activeCategory || productMatchesCategory(product, activeCategory);
      const inSize = activeSize === "all" || product.variations.some((variation) => variationSize(variation.name) === activeSize);
      const matchesSearch = !query || product.name.toLowerCase().includes(query);
      const matchesGender = !gender || productMatchesGender(product, gender);
      return inCategory && inSize && matchesSearch && matchesGender;
    });

    if (sortBy === "price-asc") return [...result].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") return [...result].sort((a, b) => b.price - a.price);
    if (sortBy === "name") return [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [activeCategory, activeSize, products, searchTerm, sortBy, gender]);

  const hasActiveDiscovery = activeCategory !== undefined || activeSize !== "all" || searchTerm.trim().length > 0;
  const visibleProducts = filtered.slice(0, visibleCount);

  const resetDiscovery = () => {
    setActiveSize("all");
    setSearchTerm("");
  };

  const control = "min-h-11 border border-border/60 bg-void px-3 py-2 text-sm text-cream placeholder:text-muted transition-colors duration-200 focus:border-accent focus:outline-none";
  const toggle = "min-h-11 border px-3 text-xs font-bold uppercase tracking-[0.06em] transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.98]";

  useEffect(() => {
    if (searchTerm.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      trackCommerceEvent({ name: filtered.length ? "search" : "search_no_results", resultCount: filtered.length });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [filtered.length, searchTerm]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, activeSize, searchTerm, sortBy, viewMode]);

  const categoryHref = (slug: string) =>
    slug === "all" ? basePath : `${basePath}/${slug}`;

  return (
    <section aria-label="Product catalog">
      <div className="mb-8 border-y border-border/40 py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(15rem,1fr)_auto] xl:items-start">
          <div>
            <label htmlFor="category-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Search</label>
            <input id="category-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Product name" className={`${control} w-full`} />
          </div>
          <div className="flex flex-wrap gap-2 xl:pt-6" role="group" aria-label="Catalog view">
            {(["grid", "index"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)} aria-pressed={viewMode === mode} className={`${toggle} ${viewMode === mode ? "border-accent bg-accent text-white" : "border-border/60 text-cream hover:border-accent"}`}>
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">Category</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            <Link
              href={categoryHref("all")}
              aria-pressed={activeCategory === undefined}
              className={`${toggle} ${activeCategory === undefined ? "border-accent bg-accent text-white" : "border-border/60 text-cream hover:border-accent"}`}
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
                  aria-pressed={activeCategory === category.slug}
                  aria-label={`${category.name}, ${count} products`}
                  className={`${toggle} inline-flex items-center gap-2 ${activeCategory === category.slug ? "border-accent bg-surface text-cream" : "border-border/60 text-muted hover:border-accent hover:text-cream"}`}
                >
                  {category.name} <span aria-hidden="true">{count}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {sizeOptions.length > 0 && (
            <div>
              <label htmlFor="category-size" className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">Size</label>
              <select id="category-size" value={activeSize} onChange={(event) => setActiveSize(event.target.value)} className={`${control} w-full cursor-pointer`}>
                <option value="all">All sizes</option>
                {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          )}
          <div>
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

      <div className="mb-6 flex min-h-11 flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">
        <p aria-live="polite">{filtered.length} {filtered.length === 1 ? "product" : "products"}</p>
        {hasActiveDiscovery && <button type="button" onClick={resetDiscovery} className="min-h-11 text-accent underline underline-offset-4">Clear filters</button>}
      </div>

      {viewMode === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {visibleProducts.map((product, index) => {
            const image = product.images[0];
            return (
              <Link key={product.id} href={`/product/${product.slug}`} className="group block focus-visible:outline-offset-4">
                <div className="relative aspect-[3/4] overflow-hidden border-b border-border/40 bg-surface transition-colors group-hover:border-accent">
                  {image ? <Image src={image} alt={product.name} fill priority={index < 4} className={`${isPrintfulImage(image) ? "object-contain" : "object-cover"} product-art`} sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" /> : <div className="absolute inset-0 flex items-center justify-center text-xs uppercase text-muted">Image unavailable</div>}
                </div>
                <div className="border-b border-border/40 py-3 transition-colors group-hover:border-accent">
                  <h2 className="line-clamp-2 font-display text-lg font-bold uppercase leading-[0.95] tracking-[-0.025em] text-cream group-hover:text-accent">{product.name}</h2>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold">
                    <span>{product.priceFormatted}</span>
                    <span className="text-muted">Made to order</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {viewMode === "index" && filtered.length > 0 && (
        <div className="border-t border-border/40">
          {visibleProducts.map((product) => (
            <Link key={product.id} href={`/product/${product.slug}`} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-4 border-b border-border/40 py-3 transition-colors hover:bg-surface sm:grid-cols-[1fr_12rem_auto] sm:px-3">
              <span className="font-display text-base font-black uppercase leading-tight text-cream">{product.name}</span>
              <span className="hidden text-xs uppercase tracking-[0.06em] text-muted sm:block">{product.category || "Catalog"}</span>
              <span className="font-mono text-sm font-bold text-cream">{product.priceFormatted}</span>
            </Link>
          ))}
        </div>
      )}

      {visibleCount < filtered.length && (
        <div className="mt-10 flex justify-center">
          <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="min-h-12 border border-border/60 px-6 py-3 text-xs font-bold uppercase tracking-[0.06em] hover:border-accent">
            Load more products
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="border border-border/40 bg-surface px-5 py-16 text-center">
          <h2 className="font-display text-2xl font-black uppercase">No matches</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">Try another product name, size, or category.</p>
          <button type="button" onClick={resetDiscovery} className="primary-action mt-6 min-h-11 px-6 py-3 text-xs">Clear filters</button>
        </div>
      )}
    </section>
  );
}
