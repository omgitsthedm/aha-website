import Image from "next/image";
import Link from "next/link";

export function Entrance({ hasNewArrivals }: { hasNewArrivals: boolean }) {
  return (
    <section className="relative z-[2] px-4 pb-14 pt-32 md:px-6 md:pb-20 md:pt-36">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
        <div className="flex flex-col justify-between border-t-2 border-accent py-6 lg:py-8">
          <div>
            <p className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Independent streetwear from New York</p>
            <h1 className="max-w-3xl font-display text-[clamp(3.4rem,8vw,7.5rem)] font-black uppercase leading-[0.82] tracking-[-0.075em] text-cream">
              Uniform for the restless
            </h1>
            <p className="mt-6 max-w-xl font-mono text-base leading-relaxed text-muted">
              Graphic apparel for late nights, long walks, loud rooms, and life outside the expected schedule.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/shop" className="primary-action px-6 py-4 text-center text-sm">Shop the catalog</Link>
            <Link href={hasNewArrivals ? "/new-arrivals" : "/best-sellers"} className="inline-flex min-h-12 items-center justify-center border border-border/60 px-6 py-3 font-mono text-sm font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">
              {hasNewArrivals ? "See new arrivals" : "See the catalog edit"}
            </Link>
          </div>
        </div>

        <div className="relative min-h-[440px] overflow-hidden border border-border/50 bg-surface md:min-h-[620px]">
          <Image src="/brand/mosaic-hero.jpg" alt="After Hours Agenda campaign in New York" fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 58vw" />
          <div className="absolute inset-x-0 bottom-0 border-t border-border/50 bg-void/92 px-4 py-3">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.06em] text-cream">Made to order. Free shipping. 30-day returns.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
