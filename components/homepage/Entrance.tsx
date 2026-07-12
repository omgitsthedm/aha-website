import Image from "next/image";
import Link from "next/link";
import { DESIGN_SOURCES } from "@/lib/content/design-sources";

export function Entrance({ hasNewArrivals }: { hasNewArrivals: boolean }) {
  const hero = DESIGN_SOURCES[0];

  return (
    <section className="relative z-[2] px-4 pb-10 pt-28 md:px-6 md:pb-16 md:pt-32">
      <div className="mx-auto grid max-w-[1440px] gap-3 lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <div className="hero-copy-enter flex min-w-0 flex-col justify-between border-t border-accent py-6 lg:py-8 lg:pr-12">
          <div>
            <p className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">New York / Online</p>
            <h1 className="max-w-3xl break-words font-display text-[clamp(4rem,9vw,9rem)] font-bold uppercase leading-[0.76] tracking-[-0.065em] text-cream">
              After Hours Agenda
            </h1>
            <p className="mt-7 max-w-md font-mono text-sm leading-relaxed text-muted md:text-base">
              Graphic clothing and objects made when you order. Shipping included.
            </p>
          </div>

          <div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/shop" className="primary-action px-6 py-4 text-center text-sm">Shop all products</Link>
              <Link href="/lookbook" className="secondary-action px-6 py-3 text-sm">View design files</Link>
            </div>
            {hasNewArrivals && <Link href="/new-arrivals" className="mt-8 inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted underline decoration-accent underline-offset-4 hover:text-accent">See the latest release</Link>}
          </div>
        </div>

        <Link href={`/product/${hero.productSlug}`} data-design-source={hero.sourceFile} className="hero-visual-enter group relative min-h-[460px] overflow-hidden bg-accent md:min-h-[680px] lg:min-h-0">
          <Image src={hero.image} alt={hero.alt} fill priority className="object-contain p-7 transition-transform duration-500 ease-out group-hover:scale-[1.025] md:p-12" sizes="(max-width: 1024px) 100vw, 55vw" />
          <span className="absolute right-0 top-0 bg-void px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-cream">From the design archive</span>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 border-t border-void/30 bg-void/95 px-4 py-3">
            <span className="font-display text-xl font-bold uppercase tracking-[-0.03em] text-cream">{hero.title}</span>
            <span className="font-mono text-[11px] font-bold uppercase text-accent">View product</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
