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
    <section ref={sectionRef} className="relative z-[2] py-28 md:py-36 px-6 bg-[#E8E4D8]">
      <div className="max-w-3xl mx-auto">
        {/* NYCTA Sign Panel */}
        <div className="mb-10">
          <div className="mosaic-border" />
          <div className="sign-panel-station">
            <span className="sign-panel-station-text">Collections</span>
          </div>
          <div className="mosaic-border" />
        </div>

        {lined.map((col) => {
          const line = SUBWAY_LINES[col.slug];
          const lineColor = line?.color || "#A7A9AC";

          return (
            <div key={col.id} data-row>
              <Link
                href={`/collections/${col.slug}`}
                className="group flex items-center gap-5 py-7 hover:bg-surface transition-all duration-300 -mx-4 px-4 border-l-[3px] border-transparent"
                style={{
                  // @ts-expect-error -- CSS custom property for hover border
                  "--line-color": lineColor,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderLeftColor = lineColor;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent";
                }}
              >
                <RouteBadge slug={col.slug} size="lg" />
                <div className="flex-1 min-w-0">
                  <span className="font-body text-sm font-medium text-cream group-hover:text-cream transition-colors duration-300">
                    {col.name}
                  </span>
                  <span className="block font-body text-xs text-muted mt-1 truncate">
                    {col.description}
                  </span>
                </div>
                <span className="font-body text-xs font-medium text-muted group-hover:text-cream transition-all duration-300 group-hover:translate-x-1">
                  Shop &rarr;
                </span>
              </Link>
              <div className="w-full h-px bg-cream/[0.12]" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
