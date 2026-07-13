import Image from "next/image";
import Link from "next/link";
import { DESIGN_SOURCES } from "@/lib/content/design-sources";

export function Entrance({ hasNewArrivals }: { hasNewArrivals: boolean }) {
  const hero = DESIGN_SOURCES[0];

  return (
    <section className="relative z-[2] px-4 pb-12 pt-28 md:px-6 md:pb-20 md:pt-24">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch lg:gap-5">
        <div className="hero-copy-enter flex min-w-0 flex-col justify-between border-t border-accent py-6 lg:py-8 lg:pr-12">
          <div>
            <h1 className="max-w-3xl font-display text-[clamp(3.7rem,7vw,7rem)] font-bold uppercase leading-[0.76] tracking-[-0.06em] text-cream">
              <span className="hero-title-line block overflow-hidden"><span className="block whitespace-nowrap">After Hours</span></span>
              <span className="hero-title-line block overflow-hidden"><span className="block">Agenda</span></span>
            </h1>
            <p className="hero-support-enter mt-7 max-w-md font-mono text-sm leading-relaxed text-muted md:text-base">
              Original graphics, made wearable. Produced only when you order.
            </p>
          </div>

          <div className="hero-actions-enter mt-10 flex flex-col gap-3 sm:flex-row lg:mt-16">
            <Link href="/shop" className="primary-action px-6 py-4 text-center text-sm">Shop the collection</Link>
            <Link href="/lookbook" className="secondary-action px-6 py-3 text-sm">See the design files</Link>
          </div>
          {hasNewArrivals && <Link href="/new-arrivals" className="nav-link mt-6 inline-flex min-h-11 w-fit items-center font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted hover:text-cream">New arrivals are live</Link>}
        </div>

        <figure className="hero-visual-enter min-w-0">
          <Link href={`/product/${hero.productSlug}`} data-design-source={hero.sourceFile} className="group relative block min-h-[470px] overflow-hidden bg-accent md:min-h-[680px] lg:h-[calc(100%-4.25rem)]">
            <Image src={hero.image} alt={hero.alt} fill priority className="hero-product-art object-contain p-7 md:p-12" sizes="(max-width: 1024px) 100vw, 55vw" />
          </Link>
          <figcaption className="grid min-h-[4.25rem] grid-cols-[1fr_auto] items-center gap-4 border-b border-border/50 py-4">
            <Link href={`/product/${hero.productSlug}`} className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-cream transition-colors hover:text-accent">{hero.title}</Link>
            <span className="font-mono text-xs tabular-nums text-muted">Made to order</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
