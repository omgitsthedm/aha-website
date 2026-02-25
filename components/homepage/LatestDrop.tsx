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
    <section className="relative py-24 md:py-32 px-6 overflow-hidden">
      {/* Background ambient */}
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-gradient-radial from-glow-faint to-transparent opacity-20 -translate-y-1/2" />

      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <span className="font-mono text-label text-glow uppercase tracking-[0.2em] block mb-3">
            Latest Drop
          </span>
          <h2 className="font-display font-bold text-3xl md:text-chapter mb-12">
            Fresh off the press
          </h2>
        </ScrollReveal>

        {/* Editorial layout: hero product + strip */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Hero product — large */}
          <ScrollReveal>
            <Link href={`/product/${hero.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden bg-surface rounded-sm card-tilt">
                {hero.images[0] ? (
                  <Image
                    src={hero.images[0]}
                    alt={hero.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 bg-elevated" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-void/60 via-transparent to-transparent" />
              </div>
              <div className="mt-4">
                <h3 className="font-display font-bold text-xl group-hover:text-glow transition-colors">
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
                  className="group flex gap-4 items-center p-4 bg-surface/50 border border-border hover:border-glow/30 rounded-sm transition-all duration-300"
                >
                  <div className="relative w-20 h-20 flex-shrink-0 overflow-hidden bg-elevated rounded-sm">
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
                    <h3 className="font-body text-sm text-cream truncate group-hover:text-glow transition-colors">
                      {product.name}
                    </h3>
                    <p className="font-mono text-sm text-muted mt-0.5">
                      {product.priceFormatted}
                    </p>
                    <span className="font-mono text-[10px] text-muted group-hover:text-glow tracking-[0.15em] uppercase mt-2 inline-block transition-colors">
                      Shop Now &rarr;
                    </span>
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
