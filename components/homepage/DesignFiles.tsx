import Image from "next/image";
import Link from "next/link";
import { DESIGN_SOURCES } from "@/lib/content/design-sources";

export function DesignFiles({ compact = false }: { compact?: boolean }) {
  const sources = compact ? DESIGN_SOURCES.slice(0, 3) : DESIGN_SOURCES;

  return (
    <section aria-labelledby="design-files-title" className="reveal-block px-4 py-20 md:px-6 md:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="max-w-4xl">
          <h2 id="design-files-title" className="font-display text-[clamp(3.4rem,7.4vw,7.25rem)] font-bold uppercase leading-[0.78] tracking-[-0.055em] text-cream">
            The work, on fabric
          </h2>
          <p className="mt-6 max-w-lg font-mono text-sm leading-relaxed text-muted md:text-base">
            Product previews pulled from the working design library.
          </p>
        </div>

        <div className="mt-12 grid gap-x-4 gap-y-10 md:grid-cols-12">
          {sources.map((source, index) => (
            <figure key={source.sourceFile} className={`design-tile min-w-0 ${index === 0 ? "md:col-span-7" : "md:col-span-5"}`}>
              <Link href={`/product/${source.productSlug}`} data-design-source={source.sourceFile} className={`group relative block overflow-hidden focus-visible:outline-offset-4 ${index === 1 ? "bg-accent" : "bg-surface"} ${index === 0 ? "aspect-[4/5] md:aspect-[5/6]" : "aspect-[4/5]"}`}>
                <Image src={source.image} alt={source.alt} fill className="product-art object-contain p-6 md:p-10" sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : "(max-width: 768px) 100vw, 42vw"} />
              </Link>
              <figcaption className="flex min-h-16 items-center justify-between gap-4 border-b border-border/50 py-4">
                <Link href={`/product/${source.productSlug}`} className="font-display text-lg font-bold uppercase tracking-[-0.025em] text-cream transition-colors hover:text-accent">{source.title}</Link>
                <span className="font-mono text-xs text-muted">View product</span>
              </figcaption>
            </figure>
          ))}
        </div>

        {compact && <Link href="/lookbook" className="secondary-action mt-10 px-5 py-3 text-xs">Open the full design index</Link>}
      </div>
    </section>
  );
}
