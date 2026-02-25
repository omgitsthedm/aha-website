"use client";

import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface CollectionsProps {
  collections: Collection[];
}

export function Collections({ collections }: CollectionsProps) {
  if (collections.length === 0) return null;

  // Filter to just the main themed collections
  const themed = collections.filter((c) =>
    ["black-sheep", "no-kings", "night-mode", "nyc-forever", "hope--tomorrow", "the-optimist", "essentials", "new-arrivals"].includes(c.slug)
  );

  return (
    <section className="relative py-24 md:py-32 px-6 bg-charcoal">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] block mb-3">
              The Collections
            </span>
            <h2 className="font-display font-bold text-3xl md:text-chapter text-cream">
              Every collection tells a story
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border-warm">
          {themed.map((collection, i) => (
            <ScrollReveal key={collection.id} delay={i * 60}>
              <Link
                href={`/collections/${collection.slug}`}
                className="group block bg-charcoal p-8 min-h-[200px] flex flex-col justify-end transition-all duration-500 hover:bg-surface-warm"
              >
                <div>
                  <h3 className="font-display font-bold text-xl md:text-2xl mb-2 text-cream transition-colors duration-300">
                    {collection.name}
                  </h3>
                  <p className="font-body text-sm text-muted leading-relaxed">
                    {collection.description}
                  </p>
                  <span className="inline-block mt-4 font-mono text-[10px] text-muted group-hover:text-gold tracking-[0.15em] uppercase transition-colors duration-300">
                    Explore &rarr;
                  </span>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
