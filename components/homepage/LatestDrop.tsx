"use client";

import { useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";
import { gsap, useGSAP } from "@/lib/gsap";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface LatestDropProps {
  products: Product[];
}

const colSpanClass: Record<number, string> = {
  4: "md:col-span-4",
  8: "md:col-span-8",
};

const HEADER_TEXT = "Latest Drop";

export function LatestDrop({ products }: LatestDropProps) {
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

      // Product cards slide in from alternating sides
      const rows = sectionRef.current.querySelectorAll("[data-row]");
      rows.forEach((row) => {
        const cards = row.querySelectorAll("[data-card]");
        cards.forEach((card, i) => {
          const fromLeft = i % 2 === 0;
          gsap.from(card, {
            x: fromLeft ? -80 : 80,
            opacity: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              once: true,
            },
          });
        });
      });
    },
    { scope: sectionRef }
  );

  if (products.length === 0) return null;

  // Build asymmetric rows: alternating large/small pattern
  const rows: { product: Product; span: number }[][] = [];
  const items = products.slice(0, 4);

  for (let i = 0; i < items.length; i += 2) {
    const row: { product: Product; span: number }[] = [];
    const isEvenRow = rows.length % 2 === 0;

    if (items[i]) {
      row.push({
        product: items[i],
        span: isEvenRow ? 8 : 4,
      });
    }
    if (items[i + 1]) {
      row.push({
        product: items[i + 1],
        span: isEvenRow ? 4 : 8,
      });
    }
    rows.push(row);
  }

  return (
    <section ref={sectionRef} className="noise-overlay py-24 md:py-32 px-6 bg-void">
      <div className="max-w-7xl mx-auto">
        {/* Section header with rule line */}
        <div className="mb-14">
          <span className="font-mono text-label text-muted uppercase tracking-[0.2em] block mb-4">
            {headerLetters.map((char, i) => (
              <span
                key={i}
                ref={(el) => { letterRefs.current[i] = el; }}
                className="inline-block"
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </span>
          <div className="w-full h-px bg-cream/10" />
        </div>

        <div className="space-y-20">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              data-row
              className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6"
            >
              {row.map(({ product, span }) => (
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
                            span === 8
                              ? "(max-width: 768px) 100vw, 66vw"
                              : "(max-width: 768px) 100vw, 33vw"
                          }
                          priority={rowIndex === 0}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-void" />
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* VIEW ALL link */}
        <div className="flex justify-end mt-16">
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
