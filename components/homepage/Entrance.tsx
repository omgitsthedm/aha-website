"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap, useGSAP } from "@/lib/gsap";
import { SplitFlap } from "@/components/ui/SplitFlap";

const MESSAGES = [
  "BLACK SHEEP / NO KINGS / NIGHT MODE",
  "GRAPHIC TEES / LOUD COLOR / ZERO APOLOGY",
  "MADE TO ORDER / FREE SHIPPING $75+",
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
        y: 26,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: "power2.out",
      });
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden px-4 pb-12 pt-28 md:px-6 md:pb-20 md:pt-32"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="zine-block-hot zine-cut flex min-h-[520px] flex-col justify-between p-5 sm:p-8 lg:p-10">
          <div data-hero-piece className="flex flex-wrap gap-3">
            <span className="zine-sticker bg-[#CCFF00]">Streetwear</span>
            <span className="zine-sticker bg-[#00FFFF]">Blacklight</span>
            <span className="zine-sticker bg-[#FFAA00]">Made to order</span>
          </div>

          <div data-hero-piece className="py-10">
            <h1 className="misprint font-display text-[clamp(4.5rem,12vw,11rem)] font-black uppercase leading-[0.78] tracking-[-0.1em] text-[#10100F]">
              Wear It Loud
            </h1>
            <p className="mt-8 max-w-xl font-body text-lg font-bold leading-snug text-[#10100F] md:text-2xl">
              Graphic tees and after-hours layers for people allergic to boring.
            </p>
          </div>

          <div data-hero-piece className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/shop"
              className="metrocard-gradient inline-flex min-h-12 items-center justify-center px-6 py-3 text-center text-sm tracking-[0.08em] transition-transform duration-200 hover:-translate-y-1 active:translate-y-0"
            >
              Shop the Drop
            </Link>
            <Link
              href="/collections/new-arrivals"
              className="inline-flex min-h-12 items-center justify-center border-[3px] border-[#10100F] bg-[#E9E1D4] px-6 py-3 text-center font-body text-sm font-bold uppercase tracking-[0.08em] text-[#10100F] shadow-[7px_7px_0_#BF00FF] transition-transform duration-200 hover:-translate-y-1 active:translate-y-0"
            >
              New Arrivals
            </Link>
          </div>
        </div>

        <div data-hero-piece className="grid gap-5">
          <div className="zine-block zine-cut-alt relative min-h-[360px] overflow-hidden bg-[#15110F] md:min-h-[520px]">
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
            <div className="absolute left-4 top-5 rotate-[-4deg] border-[3px] border-[#10100F] bg-[#CCFF00] px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#10100F]">
              Issue 001
            </div>
            <div className="absolute bottom-5 right-4 rotate-[3deg] border-[3px] border-[#10100F] bg-[#00FFFF] px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#10100F]">
              AHA Forever
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
