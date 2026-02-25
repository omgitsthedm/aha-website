"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export function Entrance() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative bg-charcoal overflow-hidden" style={{ minHeight: "calc(100vh - 4rem)" }}>
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center md:items-stretch min-h-[inherit]">
        {/* Left: Sheep silhouette */}
        <div className="relative w-full md:w-[55%] flex items-end justify-center md:justify-start pt-24 md:pt-0">
          <div className="relative w-64 h-64 md:w-[420px] md:h-[420px] lg:w-[500px] lg:h-[500px] translate-y-8 md:translate-y-16">
            <Image
              src="/brand/sheep-full.svg"
              alt="Black Sheep"
              fill
              className="object-contain opacity-90 text-cream"
              priority
            />
          </div>
        </div>

        {/* Right: Editorial text */}
        <div className="w-full md:w-[45%] flex flex-col justify-center py-16 md:py-24 md:pl-8 lg:pl-12">
          <div
            className={`transition-all duration-700 delay-300 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <h1 className="font-display font-black text-3xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-cream text-center md:text-left">
              BUILT FOR THE ONES STILL MOVING AFTER HOURS
            </h1>

            <p className="font-mono text-sm text-muted tracking-[0.15em] uppercase mt-6 text-center md:text-left">
              Black Sheep Mentality
            </p>

            <div className="mt-8 text-center md:text-left">
              <Link
                href="/shop"
                className="inline-block border border-cream text-cream px-8 py-3 font-mono text-sm tracking-wide hover:bg-cream hover:text-void transition-all"
              >
                SHOP THE DROP
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
