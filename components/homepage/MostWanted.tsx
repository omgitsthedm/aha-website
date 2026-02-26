"use client";

import { useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { gsap, useGSAP } from "@/lib/gsap";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface MostWantedProps {
  products: Product[];
}

const spanPattern = [7, 5, 5, 7, 6, 6];

const colSpanClass: Record<number, string> = {
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
};

const HEADER_TEXT = "Most Wanted";

export function MostWanted({ products }: MostWantedProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const headerLetters = useMemo(() => HEADER_TEXT.split(""), []);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Letter-by-letter stagger reveal on the header
      const letters = letterRefs.current.filter(Boolean);
      if (letters.length > 0) {
        gsap.set(letters, { opacity: 0, y: 20 });
        gsap.to(letters, {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.03,
          ease: "power2.out",
          scrollTrigger: {
            trigger: letters[0],
            start: "top 85%",
            once: true,
          },
        });
      }

      // Product cards slide up with stagger
      const cards = sectionRef.current.querySelectorAll("[data-card]");
      gsap.from(cards, {
        y: 60,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current.querySelector("[data-grid]"),
          start: "top 85%",
          once: true,
        },
      });
    },
    { scope: sectionRef }
  );

  if (products.length === 0) return null;

  return (
    <section ref={sectionRef} className="noise-overlay py-24 md:py-32 px-6 bg-void">
      <div className="max-w-7xl mx-auto">
        {/* Section header with rule line */}
        <div className="mb-14">
          <div className="flex items-end justify-between mb-4">
            <h2 className="font-display font-bold text-section text-cream">
              {headerLetters.map((char, i) => (
                <span
                  key={i}
                  ref={(el) => { letterRefs.current[i] = el; }}
                  className="inline-block"
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
            </h2>
            <Link
              href="/shop"
              className="hidden md:block font-mono text-xs text-muted hover:text-cream transition-colors duration-300 uppercase tracking-[0.15em]"
            >
              View All &rarr;
            </Link>
          </div>
          <div className="w-full h-px bg-cream/10" />
        </div>

        <div data-grid className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          {products.slice(0, 6).map((product, i) => {
            const span = spanPattern[i] ?? 6;
            return (
              <div key={product.id} data-card className={colSpanClass[span]}>
                <Link href={`/product/${product.slug}`} className="group block">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm text-muted group-hover:text-white transition-colors duration-300">
                      {product.name}
                    </span>
                    <span className="font-mono text-base font-medium text-cream/80 tabular-nums">
                      {product.priceFormatted}
                    </span>
                  </div>
                  <div className="relative aspect-[3/4] overflow-hidden border border-transparent group-hover:border-cream/10 transition-colors duration-500">
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className={isPrintfulImage(product.images[0]) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"}
                        sizes={
                          span >= 7
                            ? "(max-width: 768px) 100vw, 58vw"
                            : "(max-width: 768px) 100vw, 42vw"
                        }
                      />
                    ) : (
                      <div className="absolute inset-0 bg-void" />
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Mobile VIEW ALL link */}
        <div className="flex justify-end mt-16 md:hidden">
          <Link
            href="/shop"
            className="font-mono text-xs text-muted hover:text-cream transition-colors duration-300 uppercase tracking-[0.15em]"
          >
            View All &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
