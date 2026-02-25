"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { gsap, useGSAP } from "@/lib/gsap";

interface ShopContentProps {
  products: Product[];
  collections: Collection[];
}

export function ShopContent({ products, collections }: ShopContentProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [viewMode, setViewMode] = useState<"grid" | "index">("grid");
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let result = products;

    if (activeFilter !== "all") {
      result = result.filter((p) => p.collectionIds.includes(activeFilter));
    }

    if (sortBy === "price-asc") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [products, activeFilter, sortBy]);

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
    <div ref={containerRef} className="noise-overlay">
      {/* View toggle + filter bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
        {/* View toggle */}
        <div className="flex items-center gap-3 mr-4">
          <button
            onClick={() => handleViewChange("grid")}
            className={`font-mono text-xs transition-colors ${
              viewMode === "grid" ? "text-cream" : "text-muted hover:text-white"
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => handleViewChange("index")}
            className={`font-mono text-xs transition-colors ${
              viewMode === "index" ? "text-cream" : "text-muted hover:text-white"
            }`}
          >
            Index
          </button>
        </div>

        {/* Filter — All button */}
        <button
          onClick={() => setActiveFilter("all")}
          className={`font-mono text-xs transition-colors ${
            activeFilter === "all" ? "text-cream" : "text-muted hover:text-white"
          }`}
        >
          All
        </button>

        {/* Filter — RouteBadge per collection */}
        {collections.map((col) => (
          <button
            key={col.id}
            onClick={() => setActiveFilter(col.id)}
            className={`transition-opacity ${
              activeFilter === col.id ? "opacity-100" : "opacity-60 hover:opacity-100"
            }`}
          >
            <RouteBadge slug={col.slug} size="sm" showName />
          </button>
        ))}

        {/* Sort */}
        <div className="ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border-b border-muted font-mono text-xs text-muted focus:border-cream focus:outline-none py-1 pr-6 cursor-pointer"
          >
            <option value="name">A-Z</option>
            <option value="price-asc">Price: Low</option>
            <option value="price-desc">Price: High</option>
          </select>
        </div>
      </div>

      {/* Product count */}
      <p className="font-mono text-[11px] text-muted mb-6">
        {filtered.length} {filtered.length === 1 ? "product" : "products"}
      </p>

      {/* GRID VIEW */}
      {viewMode === "grid" && (
        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {filtered.map((product, idx) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className={`group block ${idx === 0 ? "md:col-span-2" : ""}`}
            >
              <div className={`relative overflow-hidden bg-surface ${idx === 0 ? "aspect-[3/2]" : "aspect-[3/4]"}`}>
                {product.images[0] ? (
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    sizes={
                      idx === 0
                        ? "(max-width: 768px) 100vw, 66vw"
                        : "(max-width: 768px) 50vw, 33vw"
                    }
                  />
                ) : (
                  <div className="absolute inset-0 bg-elevated" />
                )}
              </div>

              <div className="mt-3 space-y-1">
                <h3 className="font-mono text-sm text-muted truncate group-hover:text-white transition-colors duration-300">
                  {product.name}
                </h3>
                <p className="font-mono text-sm text-muted">
                  {product.priceFormatted}
                </p>
              </div>
            </Link>
          ))}
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
                  className="group flex items-center py-4 -mx-4 px-4 hover:bg-[#1A1918] transition-colors"
                >
                  <span className="font-mono text-sm text-muted group-hover:text-white flex-1 truncate">
                    {product.name}
                  </span>
                  {colSlug && (
                    <RouteBadge slug={colSlug} size="sm" className="mx-4" />
                  )}
                  <span className="font-mono text-sm text-muted">
                    {product.priceFormatted}
                  </span>
                </Link>
                <WhiteBand />
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-24">
          <p className="font-mono text-sm text-muted">No products found</p>
          <button
            onClick={() => setActiveFilter("all")}
            className="mt-4 font-mono text-xs text-cream hover:text-white transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}
