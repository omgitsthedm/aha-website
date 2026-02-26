"use client";

import { useRef } from "react";
import Image from "next/image";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { gsap, useGSAP } from "@/lib/gsap";

export function Agenda() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      const elements = sectionRef.current.querySelectorAll("[data-fade-up]");
      gsap.from(elements, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
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

  return (
    <section ref={sectionRef} className="relative z-[2] subway-tiles-dark py-32 md:py-48 px-6 bg-[#141414]">
      <WhiteBand dark />

      {/* Inner container with inset border for depth */}
      <div className="max-w-2xl mx-auto py-16 md:py-24 px-8 md:px-16 border border-[#E8E4DE]/[0.04] relative">
        {/* Subtle corner accents for depth */}
        <div className="absolute inset-4 border border-[#E8E4DE]/[0.03] pointer-events-none" />

        <div className="text-center relative">
          {/* Subtle sheep silhouette */}
          <div data-fade-up className="flex justify-center mb-10">
            <Image
              src="/brand/sheep-full.svg"
              alt=""
              width={48}
              height={48}
              className="w-12 h-12 opacity-15"
              aria-hidden="true"
            />
          </div>

          {/* Top decorative rule — plaque style */}
          <div data-fade-up className="flex items-center justify-center gap-4 mb-10">
            <div className="w-12 h-px bg-[#E8E4DE]/15" />
            <div className="w-1 h-1 rounded-full bg-[#E8E4DE]/10" />
            <div className="w-12 h-px bg-[#E8E4DE]/15" />
          </div>

          <h2
            data-fade-up
            className="font-display font-bold text-2xl md:text-4xl text-[#E8E4DE] uppercase"
            style={{ letterSpacing: "0.12em" }}
          >
            Made for the After Hours
          </h2>

          <p data-fade-up className="font-body text-sm md:text-base text-[#7A756E] leading-relaxed mt-8 max-w-lg mx-auto">
            Born in New York. Made for the hours that matter most — the ones
            after the world clocks out. Every piece carries intent. Every
            collection tells a story. This isn't fast fashion. It's fashion
            with a point of view.
          </p>

          {/* Bottom decorative rule — plaque style */}
          <div data-fade-up className="flex items-center justify-center gap-4 mt-10">
            <div className="w-12 h-px bg-[#E8E4DE]/15" />
            <div className="w-1 h-1 rounded-full bg-[#E8E4DE]/10" />
            <div className="w-12 h-px bg-[#E8E4DE]/15" />
          </div>
        </div>
      </div>

      <WhiteBand dark />
    </section>
  );
}
