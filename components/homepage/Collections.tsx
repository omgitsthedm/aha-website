"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";

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
    <section ref={sectionRef} className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <div className="mosaic-border" />
          <div className="sign-panel-station">
            <span className="sign-panel-station-text">Drop Index</span>
          </div>
          <div className="mosaic-border" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
        {lined.map((col, i) => {
          const line = SUBWAY_LINES[col.slug];
          const lineColor = line?.color || "#A7A9AC";

          return (
            <div key={col.id} data-row className={i % 2 === 0 ? "rotate-[-0.5deg]" : "rotate-[0.5deg]"}>
              <Link
                href={`/collections/${col.slug}`}
                className="group zine-block flex min-h-[132px] items-center gap-5 px-5 py-5 transition-transform duration-200 hover:-translate-y-1"
                style={{
                  boxShadow: `8px 8px 0 ${lineColor}`,
                }}
              >
                <RouteBadge slug={col.slug} size="lg" />
                <div className="flex-1 min-w-0">
                  <span className="font-display text-2xl font-black uppercase leading-none tracking-[-0.05em] text-cream transition-colors duration-300 group-hover:text-[#CCFF00]">
                    {col.name}
                  </span>
                  <span className="mt-2 block font-body text-sm font-bold leading-snug text-muted">
                    {col.description}
                  </span>
                </div>
                <span className="zine-sticker hidden bg-[#E9E1D4] md:inline-flex">
                  Shop
                </span>
              </Link>
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}
