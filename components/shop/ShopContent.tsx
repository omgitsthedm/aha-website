"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, Collection } from "@/lib/utils/types";

interface ShopContentProps {
  products: Product[];
  collections: Collection[];
}

export function ShopContent({ products, collections }: ShopContentProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

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

  return (
    <div>
      {/* Filter bar — large clickable type */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-6 border-b border-border">
        <button
          onClick={() => setActiveFilter("all")}
          className={`font-display font-bold text-lg transition-colors ${
            activeFilter === "all" ? "text-glow" : "text-muted hover:text-cream"
          }`}
        >
          ALL
        </button>
        {collections.map((col) => (
          <button
            key={col.id}
            onClick={() => setActiveFilter(col.id)}
            className={`font-display font-bold text-lg transition-colors ${
              activeFilter === col.id ? "text-glow" : "text-muted hover:text-cream"
            }`}
          >
            {col.name.toUpperCase()}
          </button>
        ))}

        {/* Sort */}
        <div className="ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface border border-border rounded-sm px-3 py-1.5 font-mono text-xs text-muted focus:outline-none focus:border-glow/50"
          >
            <option value="name">A-Z</option>
            <option value="price-asc">Price: Low</option>
            <option value="price-desc">Price: High</option>
          </select>
        </div>
      </div>

      {/* Product count */}
      <p className="font-mono text-xs text-muted mb-6">
        {filtered.length} {filtered.length === 1 ? "product" : "products"}
      </p>

      {/* Product grid — asymmetric masonry feel */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {filtered.map((product, i) => (
          <Link
            key={product.id}
            href={`/product/${product.slug}`}
            className="group block"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-surface rounded-sm card-tilt">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              ) : (
                <div className="absolute inset-0 bg-elevated flex items-center justify-center">
                  <span className="font-mono text-xs text-muted">NO IMAGE</span>
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Quick view */}
              <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-400">
                <span className="font-mono text-[10px] text-glow tracking-[0.15em] uppercase">
                  View Product
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <h3 className="font-body text-sm text-cream truncate group-hover:text-glow transition-colors">
                {product.name}
              </h3>
              <p className="font-mono text-sm text-muted">
                {product.priceFormatted}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-24">
          <p className="font-display text-xl text-muted">No products found</p>
          <button
            onClick={() => setActiveFilter("all")}
            className="mt-4 font-mono text-sm text-glow hover:text-cream transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}
