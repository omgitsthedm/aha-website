"use client";

import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const accentColors: Record<string, string> = {
  mint: "from-neon-mint/20",
  blue: "from-neon-blue/20",
  gold: "from-neon-gold/20",
  sunrise: "from-neon-sunrise/20",
};

const accentTextColors: Record<string, string> = {
  mint: "group-hover:text-neon-mint",
  blue: "group-hover:text-neon-blue",
  gold: "group-hover:text-neon-gold",
  sunrise: "group-hover:text-neon-sunrise",
};

interface CollectionsProps {
  collections: Collection[];
}

export function Collections({ collections }: CollectionsProps) {
  if (collections.length === 0) return null;

  // Filter to just the main themed collections (not Tops/Accessories)
  const themed = collections.filter((c) =>
    ["black-sheep", "no-kings", "night-mode", "nyc-forever", "hope--tomorrow", "the-optimist", "essentials", "new-arrivals"].includes(c.slug)
  );

  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="font-mono text-label text-glow uppercase tracking-[0.2em] block mb-3">
              The Collections
            </span>
            <h2 className="font-display font-bold text-3xl md:text-chapter">
              Every collection tells a story
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {themed.map((collection, i) => {
            const accent = accentColors[collection.accent] || "from-glow/20";
            const textAccent = accentTextColors[collection.accent] || "group-hover:text-glow";

            return (
              <ScrollReveal key={collection.id} delay={i * 80}>
                <Link
                  href={`/collections/${collection.slug}`}
                  className="group block relative overflow-hidden bg-surface border border-border hover:border-transparent rounded-sm p-8 min-h-[200px] flex flex-col justify-end transition-all duration-500"
                >
                  {/* Gradient glow on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-t ${accent} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
                  />

                  <div className="relative z-10">
                    <h3
                      className={`font-display font-bold text-xl md:text-2xl mb-2 transition-colors duration-300 ${textAccent}`}
                    >
                      {collection.name}
                    </h3>
                    <p className="font-body text-sm text-muted leading-relaxed">
                      {collection.description}
                    </p>
                    <span className="inline-block mt-4 font-mono text-[10px] text-muted group-hover:text-cream tracking-[0.2em] uppercase transition-colors">
                      Explore &rarr;
                    </span>
                  </div>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
