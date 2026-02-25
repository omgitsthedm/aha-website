"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";
import { gsap, useGSAP } from "@/lib/gsap";

interface CollectionsProps {
  collections: Collection[];
}

export function Collections({ collections }: CollectionsProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Each collection row slides in from the left with stagger
      const rows = sectionRef.current.querySelectorAll("[data-row]");
      gsap.from(rows, {
        x: -60,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          once: true,
        },
      });
    },
    { scope: sectionRef }
  );

  if (collections.length === 0) return null;

  // Only show collections that have a subway line mapping
  const lined = collections.filter((c) => c.slug in SUBWAY_LINES);

  return (
    <section ref={sectionRef} className="py-24 md:py-32 px-6 bg-void">
      <WhiteBand />

      <div className="max-w-3xl mx-auto">
        <span className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] block mb-8">
          The Lines
        </span>

        {lined.map((col, i) => (
          <div key={col.id} data-row>
            <Link
              href={`/collections/${col.slug}`}
              className="group flex items-center gap-4 py-5 hover:bg-[#1A1918] transition-colors -mx-4 px-4"
            >
              {/* Platform number station sign */}
              <div className="flex-shrink-0 bg-[#141414] border border-border/30 px-2 py-1 min-w-[80px] text-center">
                <span className="font-mono text-[9px] text-[#E8E4DE]/70 uppercase tracking-[0.15em]">
                  Platform {i + 1}
                </span>
              </div>
              <RouteBadge slug={col.slug} size="lg" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm text-cream group-hover:text-white transition-colors">
                  {col.name}
                </span>
                <span className="block font-body text-xs text-muted mt-0.5 truncate">
                  {col.description}
                </span>
              </div>
              <span className="font-mono text-xs text-muted group-hover:text-white transition-colors">
                Explore &rarr;
              </span>
            </Link>
            <WhiteBand />
          </div>
        ))}
      </div>
    </section>
  );
}
