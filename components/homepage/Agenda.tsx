import Image from "next/image";

export function Agenda() {
  return (
    <section className="relative z-[2] border-y border-border/40 bg-charcoal px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[180px_1fr] md:items-center">
        <Image src="/brand/sheep-full.svg" alt="" width={180} height={180} className="h-32 w-32 opacity-90 md:h-44 md:w-44" aria-hidden="true" />
        <div>
          <h2 className="font-display text-[clamp(2.8rem,7vw,6rem)] font-black uppercase leading-[0.84] tracking-[-0.07em]">Life after the expected agenda</h2>
          <p className="mt-6 max-w-3xl font-mono text-base leading-relaxed text-muted">
            Built for late walks, basement shows, bad ideas, good books, and anyone who would rather be specific than polished. Every piece starts as a point of view, then gets made to order.
          </p>
        </div>
      </div>
    </section>
  );
}
