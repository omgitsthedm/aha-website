"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { gsap, useGSAP } from "@/lib/gsap";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface ShopContentProps {
  products: Product[];
  collections: Collection[];
}

export function ShopContent({ products, collections }: ShopContentProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("featured");
  const [viewMode, setViewMode] = useState<"grid" | "index">("grid");
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLDivElement>(null);

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      for (const collectionId of product.collectionIds) {
        counts.set(collectionId, (counts.get(collectionId) || 0) + 1);
      }
    }
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;

    if (activeFilter !== "all") {
      result = result.filter((p) => p.collectionIds.includes(activeFilter));
    }

    if (sortBy === "featured") {
      result = [...result];
    } else if (sortBy === "price-asc") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [products, activeFilter, sortBy]);

  const heroImageSrc = filtered[0]?.images[0];

  /** Derive the collection slug for a product (first matching known collection) */
  const getProductCollectionSlug = (product: Product): string | undefined => {
    for (const cid of product.collectionIds) {
      const col = collections.find((c) => c.id === cid);
      if (col) return col.slug;
    }
    return undefined;
  };

  /** Animate grid items on mount / filter change */
  const animateGrid = useCallback(() => {
    if (!gridRef.current) return;
    const items = gridRef.current.children;
    if (!items.length) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out", overwrite: true }
    );
  }, []);

  /** Animate index rows on mount / filter change */
  const animateIndex = useCallback(() => {
    if (!indexRef.current) return;
    const rows = indexRef.current.children;
    if (!rows.length) return;
    gsap.fromTo(
      rows,
      { opacity: 0, x: -40 },
      { opacity: 1, x: 0, duration: 0.4, stagger: 0.08, ease: "power2.out", overwrite: true }
    );
  }, []);

  /** Animate on initial load */
  useGSAP(() => {
    if (viewMode === "grid") animateGrid();
    else animateIndex();
  }, { scope: containerRef, dependencies: [filtered, viewMode] });

  /** Animate view transition */
  const handleViewChange = useCallback(
    (mode: "grid" | "index") => {
      if (mode === viewMode) return;
      // Fade out current content
      const currentRef = viewMode === "grid" ? gridRef.current : indexRef.current;
      if (currentRef) {
        gsap.to(currentRef.children, {
          opacity: 0,
          duration: 0.2,
          ease: "power1.in",
          onComplete: () => {
            setViewMode(mode);
          },
        });
      } else {
        setViewMode(mode);
      }
    },
    [viewMode]
  );

  return (
    <div ref={containerRef}>
      <div className="mb-6">
        <div className="mosaic-border-thin" />
        <div className="zine-block flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4">
          <div className="flex items-center gap-3 mr-4" role="group" aria-label="View mode">
            <button
              onClick={() => handleViewChange("grid")}
              aria-pressed={viewMode === "grid"}
              className={`min-h-11 border-[3px] px-3 font-body text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                viewMode === "grid"
                  ? "border-[#CCFF00] bg-[#CCFF00] text-[#10100F]"
                  : "border-[#E9E1D4] text-[#E9E1D4] hover:bg-[#E9E1D4] hover:text-[#10100F]"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => handleViewChange("index")}
              aria-pressed={viewMode === "index"}
              className={`min-h-11 border-[3px] px-3 font-body text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                viewMode === "index"
                  ? "border-[#00FFFF] bg-[#00FFFF] text-[#10100F]"
                  : "border-[#E9E1D4] text-[#E9E1D4] hover:bg-[#E9E1D4] hover:text-[#10100F]"
              }`}
            >
              Index
            </button>
          </div>

          <button
            onClick={() => setActiveFilter("all")}
            aria-pressed={activeFilter === "all"}
            className={`min-h-11 border-[3px] px-3 font-body text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
              activeFilter === "all"
                ? "border-[#FF006E] bg-[#FF006E] text-[#E9E1D4]"
                : "border-[#E9E1D4] text-[#E9E1D4] hover:bg-[#E9E1D4] hover:text-[#10100F]"
            }`}
          >
            All
          </button>

          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => setActiveFilter(col.id)}
              aria-pressed={activeFilter === col.id}
              aria-label={`Filter by ${col.name}, ${collectionCounts.get(col.id) || 0} products`}
              className={`transition-opacity min-h-[44px] ${
                activeFilter === col.id ? "opacity-100" : "opacity-60 hover:opacity-100"
              }`}
            >
              <RouteBadge slug={col.slug} size="sm" showName />
              <span className="ml-1 font-mono text-[10px] font-bold text-muted">
                {collectionCounts.get(col.id) || 0}
              </span>
            </button>
          ))}

          <div className="ml-auto">
            <label htmlFor="shop-sort" className="sr-only">Sort products by</label>
            <select
              id="shop-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-h-11 cursor-pointer border-[3px] border-[#E9E1D4] bg-[#10100F] px-3 py-2 font-body text-xs font-bold uppercase text-[#E9E1D4] focus:border-[#00FFFF] focus:outline-none"
            >
              <option value="featured">Featured</option>
              <option value="name">A-Z</option>
              <option value="price-asc">Price: Low</option>
              <option value="price-desc">Price: High</option>
            </select>
          </div>
        </div>
        <div className="mosaic-border-thin" />
      </div>

      {/* Product count */}
      <p className="font-body text-xs font-bold uppercase tracking-[0.08em] text-muted mb-6">
        {filtered.length} {filtered.length === 1 ? "product" : "products"}
      </p>

      {/* GRID VIEW — Subway Poster Cards */}
      {viewMode === "grid" && (
        <div ref={gridRef} className="grid grid-cols-2 gap-5 md:grid-cols-6 md:gap-7">
          {filtered.map((product, i) => {
            const productImage = product.images[0];
            const isPrintful = isPrintfulImage(productImage);
            const isHeroImage = productImage === heroImageSrc;
            const spanClass = i % 7 === 0 ? "md:col-span-3" : "md:col-span-2";

            return (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className={`group block product-card-hover ${spanClass}`}
              >
                <div className="subway-poster aspect-[3/4] bg-surface">
                  {productImage ? (
                    <Image
                      src={productImage}
                      alt={product.name}
                      fill
                      unoptimized={isPrintful}
                      priority={isHeroImage}
                      className={`${
                        isPrintful
                          ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                          : "object-cover xerox-image"
                      } transition-transform duration-700 group-hover:scale-[1.03]`}
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-surface" />
                  )}

                  {/* Poster info scrim */}
                  <div className="subway-poster-scrim">
                    <h3 className="font-display font-bold text-xs md:text-sm text-[#E8E4DE] uppercase tracking-[0.06em] truncate">
                      {product.name}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-mono text-xs font-semibold text-[#FCCC0A] md:text-sm">
                        {product.priceFormatted}
                      </p>
                      <p className="font-body text-[9px] font-bold uppercase tracking-[0.08em] text-[#CCFF00]">
                        Made to order
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* INDEX VIEW */}
      {viewMode === "index" && (
        <div ref={indexRef}>
          {filtered.map((product) => {
            const colSlug = getProductCollectionSlug(product);
            return (
              <div key={product.id}>
                <Link
                  href={`/product/${product.slug}`}
                  className="group zine-block my-3 flex items-center px-4 py-4 transition-transform hover:-translate-y-0.5"
                >
                  <span className="font-body text-sm font-bold text-muted group-hover:text-[#CCFF00] flex-1 truncate">
                    {product.name}
                  </span>
                  {colSlug && (
                    <RouteBadge slug={colSlug} size="sm" className="mx-4" />
                  )}
                  <span className="font-mono text-sm font-bold text-cream">
                    {product.priceFormatted}
                  </span>
                  <span className="ml-4 hidden font-body text-[10px] font-bold uppercase tracking-[0.08em] text-[#CCFF00] sm:inline">
                    Made to order
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-24">
          <p className="font-body text-sm font-bold text-muted">
            No products match this filter. Clear it to get back to the full wall.
          </p>
          <button
            onClick={() => setActiveFilter("all")}
            className="metrocard-gradient mt-6 px-6 py-3 font-body text-xs font-bold uppercase"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}
