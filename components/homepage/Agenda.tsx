import Image from "next/image";
import { WhiteBand } from "@/components/ui/WhiteBand";

export function Agenda() {
  return (
    <section className="py-32 md:py-48 px-6 bg-void">
      <WhiteBand />

      <div className="max-w-2xl mx-auto text-center">
        {/* Subtle sheep silhouette */}
        <div className="flex justify-center mb-8">
          <Image
            src="/brand/sheep-full.svg"
            alt=""
            width={48}
            height={48}
            className="w-12 h-12 opacity-15"
            aria-hidden="true"
          />
        </div>

        <h2 className="font-display font-bold text-2xl md:text-4xl text-cream uppercase tracking-tight">
          UNIFORM FOR THE RELENTLESS
        </h2>

        <p className="font-body text-sm md:text-base text-muted leading-relaxed mt-6 max-w-lg mx-auto">
          Born in New York. Built after hours. For the ones who refuse to
          follow the flock. Every piece carries the black sheep mark —
          because standing apart is the only agenda worth keeping.
        </p>
      </div>

      <WhiteBand />
    </section>
  );
}
