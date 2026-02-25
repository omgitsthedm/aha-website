"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface LatestDropProps {
  products: Product[];
}

export function LatestDrop({ products }: LatestDropProps) {
  if (products.length === 0) return null;

  const hero = products[0];
  const rest = products.slice(1);

  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <span className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] block mb-3">
            Featured
          </span>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-cream mb-12">
            New This Week
          </h2>
        </ScrollReveal>

        {/* Editorial layout: hero product + strip */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Hero product — large */}
          <ScrollReveal>
            <Link href={`/product/${hero.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden bg-surface">
                {hero.images[0] ? (
                  <Image
                    src={hero.images[0]}
                    alt={hero.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-elevated" />
                )}
              </div>
              <div className="mt-4">
                <h3 className="font-display font-bold text-xl group-hover:text-gold transition-colors duration-300">
                  {hero.name}
                </h3>
                <p className="font-mono text-sm text-muted mt-1">
                  {hero.priceFormatted}
                </p>
              </div>
            </Link>
          </ScrollReveal>

          {/* Rest — stacked on right */}
          <div className="flex flex-col gap-4">
            {rest.map((product, i) => (
              <ScrollReveal key={product.id} delay={i * 100}>
                <Link
                  href={`/product/${product.slug}`}
                  className="group flex gap-4 items-center p-4 border border-border hover:border-warm transition-all duration-300"
                >
                  <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden bg-surface">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-elevated" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-body text-sm text-cream truncate group-hover:text-gold transition-colors duration-300">
                      {product.name}
                    </h3>
                    <p className="font-mono text-sm text-muted mt-0.5">
                      {product.priceFormatted}
                    </p>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
