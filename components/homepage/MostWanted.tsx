"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface MostWantedProps {
  products: Product[];
}

export function MostWanted({ products }: MostWantedProps) {
  if (products.length === 0) return null;

  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="font-mono text-label text-muted uppercase tracking-[0.2em] block mb-3">
                Most Wanted
              </span>
              <h2 className="font-display font-bold text-3xl md:text-4xl">
                The pieces everyone&apos;s after
              </h2>
            </div>
            <Link
              href="/shop"
              className="hidden md:block font-mono text-xs text-muted hover:text-cream transition-colors uppercase tracking-[0.1em]"
            >
              View All &rarr;
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          {products.map((product, i) => {
            const isLarge = i === 0;
            return (
              <ScrollReveal
                key={product.id}
                delay={i * 80}
                className={isLarge ? "md:col-span-2 md:row-span-2" : ""}
              >
                <Link href={`/product/${product.slug}`} className="group block">
                  <div
                    className={`relative overflow-hidden bg-surface ${
                      isLarge
                        ? "aspect-[3/4] md:aspect-[4/5]"
                        : "aspect-[3/4]"
                    }`}
                  >
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        sizes={
                          isLarge
                            ? "(max-width: 768px) 100vw, 66vw"
                            : "(max-width: 768px) 50vw, 33vw"
                        }
                      />
                    ) : (
                      <div className="absolute inset-0 bg-elevated" />
                    )}
                  </div>

                  <div className="mt-3 space-y-1">
                    <h3 className="font-body text-sm text-cream truncate group-hover:text-gold transition-colors duration-300">
                      {product.name}
                    </h3>
                    <p className="font-mono text-sm text-muted">
                      {product.priceFormatted}
                    </p>
                  </div>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Mobile "View All" link */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/shop"
            className="font-mono text-xs text-muted hover:text-cream transition-colors uppercase tracking-[0.1em]"
          >
            View All Products &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
