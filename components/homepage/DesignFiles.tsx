import Image from "next/image";
import Link from "next/link";
import { DESIGN_SOURCES } from "@/lib/content/design-sources";

export function DesignFiles({ compact = false }: { compact?: boolean }) {
  const sources = compact ? DESIGN_SOURCES.slice(0, 3) : DESIGN_SOURCES;

  return (
    <section aria-labelledby="design-files-title" className="px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="max-w-3xl">
          <h2 id="design-files-title" className="font-display text-[clamp(2.7rem,7vw,6.5rem)] font-bold uppercase leading-[0.82] tracking-[-0.055em] text-cream">
            Design files in use
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            Current product previews connected to the maintained design library, not invented campaign art.
          </p>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-12 md:grid-rows-2">
          {sources.map((source, index) => (
            <Link
              key={source.sourceFile}
              href={`/product/${source.productSlug}`}
              data-design-source={source.sourceFile}
              className={`group relative min-h-[22rem] overflow-hidden border border-border/50 bg-surface focus-visible:outline-offset-4 ${
                index === 0
                  ? "md:col-span-7 md:row-span-2 md:min-h-[44rem]"
                  : index === 1
                    ? "md:col-span-5"
                    : "md:col-span-5"
              }`}
            >
              <Image
                src={source.image}
                alt={source.alt}
                fill
                className="object-contain p-5 transition-transform duration-300 ease-out group-hover:scale-[1.025] md:p-8"
                sizes={index === 0 ? "(max-width: 768px) 100vw, 58vw" : "(max-width: 768px) 100vw, 42vw"}
              />
              <span className="absolute inset-x-0 bottom-0 flex min-h-14 items-center justify-between gap-4 border-t border-border/50 bg-void/95 px-4 py-3">
                <span className="font-display text-lg font-bold uppercase tracking-[-0.025em] text-cream">{source.title}</span>
                <span className="font-mono text-[11px] font-bold uppercase text-accent">View product</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
