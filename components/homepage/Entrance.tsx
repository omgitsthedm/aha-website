import Image from "next/image";
import Link from "next/link";

export function Entrance({ hasNewArrivals }: { hasNewArrivals: boolean }) {
  return (
    <section className="relative z-[2] px-4 pb-12 pt-28 md:px-6 md:pb-20 md:pt-32">
      <div className="mx-auto grid max-w-[1440px] gap-6 lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[0.82fr_1.18fr] lg:items-stretch">
        <div className="hero-copy-enter flex min-w-0 flex-col justify-between border-t-2 border-accent py-6 lg:py-8">
          <div>
            <p className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">After Hours Agenda / New York</p>
            <h1 className="max-w-3xl break-words font-display text-[clamp(3.25rem,7.5vw,7.25rem)] font-black uppercase leading-[0.82] tracking-[-0.075em] text-cream">
              The night is yours
            </h1>
            <p className="mt-6 max-w-lg font-mono text-base leading-relaxed text-muted">
              Independent New York graphic apparel for second shifts, late trains, unfinished ideas, loud rooms, and every plan you make for yourself.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/shop" className="primary-action px-6 py-4 text-center text-sm">Shop the design index</Link>
            <Link href={hasNewArrivals ? "/new-arrivals" : "/catalog-edit"} className="inline-flex min-h-12 items-center justify-center border border-border/60 px-6 py-3 font-mono text-sm font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">
              {hasNewArrivals ? "See new arrivals" : "See the catalog edit"}
            </Link>
          </div>
        </div>

        <div className="hero-visual-enter relative min-h-[440px] overflow-hidden border border-border/50 bg-surface md:min-h-[620px] lg:min-h-0">
          <Image src="/brand/mosaic-hero.webp" alt="After Hours Agenda campaign in New York" fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 58vw" />
          <div className="absolute inset-x-0 bottom-0 border-t border-border/50 bg-void/95 px-4 py-3 md:flex md:items-center md:justify-between md:gap-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.06em] text-cream">Printed after you order. Shipping included.</p>
            <p className="mt-1 font-mono text-[11px] text-muted md:mt-0">2-5 business days in production / 30-day returns</p>
          </div>
        </div>
      </div>
    </section>
  );
}
