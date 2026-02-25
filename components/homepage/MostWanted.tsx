"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";

interface MostWantedProps {
  products: Product[];
}

const spanPattern = [7, 5, 5, 7, 6, 6];

const colSpanClass: Record<number, string> = {
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
};

export function MostWanted({ products }: MostWantedProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-24 md:py-32 px-6 bg-void">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <h2 className="font-display font-bold text-section text-cream">
            Most Wanted
          </h2>
          <Link
            href="/shop"
            className="hidden md:block font-mono text-xs text-muted hover:text-white transition-colors uppercase tracking-[0.1em]"
          >
            View All &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {products.slice(0, 6).map((product, i) => {
            const span = spanPattern[i] ?? 6;
            return (
              <div key={product.id} className={colSpanClass[span]}>
                <Link href={`/product/${product.slug}`} className="group block">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm text-muted group-hover:text-white transition-colors">
                      {product.name}
                    </span>
                    <span className="font-mono text-sm text-muted">
                      {product.priceFormatted}
                    </span>
                  </div>
                  <div className="relative aspect-[3/4] overflow-hidden">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes={
                          span >= 7
                            ? "(max-width: 768px) 100vw, 58vw"
                            : "(max-width: 768px) 100vw, 42vw"
                        }
                      />
                    ) : (
                      <div className="absolute inset-0 bg-void" />
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
