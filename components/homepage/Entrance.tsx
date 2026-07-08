"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap, useGSAP } from "@/lib/gsap";
import { SplitFlap } from "@/components/ui/SplitFlap";

const MESSAGES = [
  "BLACKLIGHT GRUNGE / HARD BORDERS / ZERO POLISH",
  "GRAPHIC TEES / LOUD COLOR / MADE AFTER HOURS",
  "NO KINGS / NO BASICS / FREE SHIPPING $75+",
];

export function Entrance() {
  const containerRef = useRef<HTMLElement>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 4800);
    return () => clearInterval(interval);
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      gsap.from("[data-hero-piece]", {
        y: 28,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: "power2.out",
      });

      gsap.from("[data-collage-shape]", {
        scale: 0.72,
        rotate: -8,
        opacity: 0,
        duration: 0.7,
        stagger: 0.07,
        ease: "back.out(1.7)",
      });
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden px-4 pb-14 pt-28 md:px-6 md:pb-24 md:pt-32"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
        <div className="zine-block-hot zine-cut flex min-h-[560px] flex-col justify-between p-5 sm:p-8 lg:p-10">
          <div data-hero-piece className="flex flex-wrap gap-3">
            <span className="zine-sticker bg-[#CCFF00]">Blacklight</span>
            <span className="zine-sticker bg-[#00FFFF]">Zine Issue</span>
            <span className="zine-sticker bg-[#FF1493] text-[#E9E1D4]">After Hours</span>
            <span className="zine-sticker bg-[#FFAA00]">Made to order</span>
          </div>

          <div data-hero-piece className="py-10 md:py-14">
            <p className="mb-5 inline-flex border-[3px] border-[#10100F] bg-[#E9E1D4] px-3 py-2 font-body text-xs font-black uppercase tracking-[0.14em] text-[#10100F] shadow-[5px_5px_0_#BF00FF]">
              After Hours Agenda / 2026 Drop System
            </p>
            <h1 className="misprint font-display text-[clamp(4.4rem,11.6vw,11rem)] font-black uppercase leading-[0.76] tracking-[-0.105em] text-[#10100F]">
              Wear It Loud
            </h1>
            <p className="mt-8 max-w-2xl font-body text-lg font-black leading-snug text-[#10100F] md:text-2xl">
              Bright-block streetwear built like a photocopied flyer: rough edges,
              harsh borders, black background energy, and color that refuses to behave.
            </p>
          </div>

          <div data-hero-piece className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/shop"
              className="metrocard-gradient min-h-12 px-6 py-3 text-center text-sm tracking-[0.1em] transition-all duration-200 hover:-translate-y-1 active:translate-y-0"
            >
              Shop the Drop
            </Link>
            <Link
              href="/collections/new-arrivals"
              className="inline-flex min-h-12 items-center justify-center border-[4px] border-[#10100F] bg-[#E9E1D4] px-6 py-3 text-center font-body text-sm font-black uppercase tracking-[0.1em] text-[#10100F] shadow-[8px_8px_0_#BF00FF] transition-all duration-200 hover:-translate-y-1 hover:bg-[#00FFFF] active:translate-y-0"
            >
              New Arrivals
            </Link>
          </div>
        </div>

        <div data-hero-piece className="grid gap-5">
          <div className="zine-block zine-cut-alt relative min-h-[430px] overflow-hidden bg-[#15110F] p-4 md:min-h-[560px] md:p-5">
            <div className="blacklight-collage h-full min-h-[398px] md:min-h-[520px]" aria-hidden="true">
              <span data-collage-shape className="collage-shape lime" />
              <span data-collage-shape className="collage-shape cyan" />
              <span data-collage-shape className="collage-shape pink" />
              <span data-collage-shape className="collage-shape sun" />
              <span className="duct-tape one" />
              <span className="duct-tape two" />
              <span className="issue-label">Issue 001 / Night Goods</span>
              <div className="collage-photo">
                <Image
                  src="/brand/mosaic-hero.jpg"
                  alt="After Hours Agenda black sheep mosaic artwork"
                  fill
                  className="xerox-image object-cover"
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  priority
                  quality={90}
                />
                <div className="absolute inset-0 bg-[#10100F]/20 mix-blend-multiply" />
              </div>
            </div>
          </div>

          <div className="zine-block p-4">
            <SplitFlap
              value={MESSAGES[messageIndex]}
              fontSize="clamp(0.82rem, 2.2vw, 1.2rem)"
              staggerDelay={16}
              shrinkToFit
            />
          </div>
        </div>
      </div>
      <div className="platform-edge mt-10" />
    </section>
  );
}

export default Entrance;
