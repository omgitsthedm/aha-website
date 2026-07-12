import Image from "next/image";
import Link from "next/link";

export function Agenda() {
  return (
    <section className="relative z-[2] overflow-hidden px-4 py-20 md:px-6 md:py-32">
      <div className="mx-auto grid max-w-[1440px] gap-10 md:grid-cols-[0.7fr_1.3fr] md:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-sm border border-border/40 bg-cream p-8 md:mx-0">
          <Image src="/brand/sheep-full.svg" alt="After Hours Agenda black sheep" fill className="object-contain p-8" sizes="384px" />
        </div>
        <div className="min-w-0">
          <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">The house point of view</p>
          <h2 className="break-words font-display text-[clamp(3rem,7vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.07em]">The black sheep is not lost</h2>
          <p className="mt-7 max-w-2xl font-mono text-base leading-relaxed text-muted">
            It is the person who stopped following a schedule written by somebody else. The mark faces left: outside the line, still looking at the world. Every AHA graphic starts from that point of view.
          </p>
          <Link href="/about" className="mt-7 inline-flex min-h-11 items-center border border-border/60 px-5 py-3 font-mono text-xs font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">Read the AHA story</Link>
        </div>
      </div>
    </section>
  );
}
