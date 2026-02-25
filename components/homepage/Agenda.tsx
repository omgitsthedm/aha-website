"use client";

import Image from "next/image";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

export function Agenda() {
  return (
    <section className="relative py-32 md:py-48 px-6 bg-void">
      <div className="max-w-3xl mx-auto text-center">
        <ScrollReveal>
          {/* Subtle sheep silhouette */}
          <div className="flex justify-center mb-8">
            <Image
              src="/brand/sheep-full.svg"
              alt=""
              width={64}
              height={64}
              className="opacity-30"
              aria-hidden="true"
            />
          </div>

          <h2 className="font-display font-black text-2xl md:text-4xl text-cream tracking-tight">
            UNIFORM FOR THE RELENTLESS
          </h2>

          <p className="font-body text-sm md:text-base text-muted leading-relaxed mt-6 max-w-lg mx-auto">
            Born in New York. Built after hours. For the ones who refuse to
            follow the flock. Every piece carries the black sheep mark —
            because standing apart is the only agenda worth keeping.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
