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
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-6 border-b border-border">
        <button
          onClick={() => setActiveFilter("all")}
          className={`font-display font-bold text-sm uppercase tracking-[0.05em] transition-colors ${
            activeFilter === "all" ? "text-cream" : "text-muted hover:text-cream"
          }`}
        >
          All
        </button>
        {collections.map((col) => (
          <button
            key={col.id}
            onClick={() => setActiveFilter(col.id)}
            className={`font-display font-bold text-sm uppercase tracking-[0.05em] transition-colors ${
              activeFilter === col.id ? "text-cream" : "text-muted hover:text-cream"
            }`}
          >
            {col.name}
          </button>
        ))}

        {/* Sort */}
        <div className="ml-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border border-border px-3 py-1.5 font-mono text-xs text-muted focus:outline-none focus:border-cream/30"
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

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {filtered.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.slug}`}
            className="group block"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-surface">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              ) : (
                <div className="absolute inset-0 bg-elevated" />
              )}
            </div>

            <div className="mt-3 space-y-1">
              <h3 className="font-body text-sm text-cream truncate group-hover:text-glow transition-colors duration-300">
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
          <p className="font-body text-sm text-muted">No products found</p>
          <button
            onClick={() => setActiveFilter("all")}
            className="mt-4 font-mono text-xs text-cream hover:text-glow transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}
