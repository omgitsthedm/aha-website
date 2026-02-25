"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";

interface LatestDropProps {
  products: Product[];
}

const colSpanClass: Record<number, string> = {
  4: "md:col-span-4",
  8: "md:col-span-8",
};

export function LatestDrop({ products }: LatestDropProps) {
  if (products.length === 0) return null;

  // Build asymmetric rows: alternating large/small pattern
  const rows: { product: Product; span: number }[][] = [];
  const items = products.slice(0, 4);

  for (let i = 0; i < items.length; i += 2) {
    const row: { product: Product; span: number }[] = [];
    const isEvenRow = rows.length % 2 === 0;

    if (items[i]) {
      row.push({
        product: items[i],
        span: isEvenRow ? 8 : 4,
      });
    }
    if (items[i + 1]) {
      row.push({
        product: items[i + 1],
        span: isEvenRow ? 4 : 8,
      });
    }
    rows.push(row);
  }

  return (
    <section className="py-24 md:py-32 px-6 bg-void">
      <div className="max-w-7xl mx-auto">
        <span className="font-mono text-label text-muted uppercase tracking-[0.2em] block mb-12">
          New This Week
        </span>

        <div className="space-y-20">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6"
            >
              {row.map(({ product, span }) => (
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
                            span === 8
                              ? "(max-width: 768px) 100vw, 66vw"
                              : "(max-width: 768px) 100vw, 33vw"
                          }
                          priority={rowIndex === 0}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-void" />
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
