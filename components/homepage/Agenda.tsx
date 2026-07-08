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
    <section ref={sectionRef} className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <WhiteBand dark />

      <div className="zine-block-lime zine-cut mx-auto my-10 max-w-5xl px-5 py-12 md:px-12 md:py-16">
        <div className="relative grid gap-8 md:grid-cols-[0.7fr_1.3fr] md:items-center">
          <div data-fade-up className="flex justify-center md:justify-start">
            <Image
              src="/brand/sheep-full.svg"
              alt=""
              width={48}
              height={48}
              className="h-32 w-32 opacity-80 md:h-44 md:w-44"
              aria-hidden="true"
            />
          </div>

          <div>
            <span data-fade-up className="zine-sticker mb-5 bg-[#FF006E] text-[#E9E1D4]">
              The agenda
            </span>
            <h2
              data-fade-up
              className="font-display text-[clamp(3rem,7vw,6rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] text-[#10100F]"
            >
              Uniform for the restless
            </h2>

            <p data-fade-up className="mt-7 max-w-2xl font-body text-base font-bold leading-relaxed text-[#10100F] md:text-lg">
              Built for late walks, basement shows, bad ideas, good books, and
              anyone who would rather be loud than polished. Every piece starts
              as a graphic point of view, then gets made to order.
            </p>
          </div>
        </div>
      </div>

      <WhiteBand dark />
    </section>
  );
}
