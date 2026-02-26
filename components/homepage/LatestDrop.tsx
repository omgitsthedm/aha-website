"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/utils/types";

import { gsap, useGSAP } from "@/lib/gsap";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

interface LatestDropProps {
  products: Product[];
}

export function LatestDrop({ products }: LatestDropProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current) return;

      // Sign panel slides up as a unit (authentic to real signage)
      const panel = sectionRef.current.querySelector("[data-sign-panel]");
      if (panel) {
        gsap.from(panel, {
          y: 20,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: panel,
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
        stagger: 0.12,
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
    <section ref={sectionRef} className="relative z-[2] py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* NYCTA Sign Panel */}
        <div data-sign-panel className="mb-14">
          <div className="mosaic-border" />
          <div className="sign-panel-station">
            <span className="sign-panel-station-text">Just Dropped</span>
          </div>
          <div className="mosaic-border" />
        </div>

        {/* Station Domination: featured + supporting posters */}
        <div data-grid className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {products.slice(0, 4).map((product, i) => {
            const isFeatured = i === 0;
            const isWide = i === 3;
            const isPrintful = isPrintfulImage(product.images[0]);

            return (
              <div
                key={product.id}
                data-card
                className={`product-card-hover ${
                  isFeatured ? "md:col-span-2 md:row-span-2" : ""
                }${isWide ? " md:col-span-2" : ""}`}
              >
                <Link href={`/product/${product.slug}`} className="group block h-full">
                  <div
                    className={`subway-poster bg-surface ${
                      isFeatured || isWide
                        ? "aspect-[3/4] md:aspect-auto md:h-full md:min-h-[280px]"
                        : "aspect-[3/4]"
                    }`}
                  >
                    {product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        unoptimized={isPrintful}
                        className={`${
                          isPrintful
                            ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                            : "object-cover"
                        } transition-transform duration-700 group-hover:scale-[1.03]`}
                        sizes={
                          isFeatured
                            ? "(max-width: 768px) 50vw, 50vw"
                            : isWide
                            ? "(max-width: 768px) 50vw, 50vw"
                            : "(max-width: 768px) 50vw, 25vw"
                        }
                        priority={i < 2}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-surface" />
                    )}

                    {/* Poster info scrim */}
                    <div className={`subway-poster-scrim ${isFeatured ? "md:p-5 md:pt-16" : ""}`}>
                      <h3
                        className={`font-display font-bold text-[#E8E4DE] uppercase tracking-[0.06em] truncate ${
                          isFeatured
                            ? "text-xs md:text-base"
                            : "text-xs md:text-sm"
                        }`}
                      >
                        {product.name}
                      </h3>
                      <p
                        className={`font-mono font-semibold text-[#FCCC0A] mt-1 ${
                          isFeatured
                            ? "text-sm md:text-lg"
                            : "text-xs md:text-sm"
                        }`}
                      >
                        {product.priceFormatted}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* VIEW ALL */}
        <div className="flex justify-center mt-16">
          <Link
            href="/shop"
            className="metrocard-gradient inline-block px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] hover:brightness-110 transition-all"
          >
            Shop New Arrivals &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
