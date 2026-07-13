import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { COLLECTION_CODES } from "@/lib/utils/collection-codes";

export function Collections({ collections }: { collections: Collection[] }) {
  const visible = collections.filter((collection) => collection.slug in COLLECTION_CODES);
  if (visible.length === 0) return null;
  const [spotlight, ...routes] = visible;

  return (
    <section className="reveal-block relative z-[2] px-4 py-20 md:px-6 md:py-32">
      <div className="mx-auto max-w-[1440px]">
        <h2 className="max-w-4xl font-display text-[clamp(3.2rem,6.5vw,6.4rem)] font-bold uppercase leading-[0.8] tracking-[-0.055em]">Find your way in</h2>
        <p className="mt-5 max-w-lg font-mono text-sm leading-relaxed text-muted">Shop by the idea behind the product.</p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <Link href={`/collections/${spotlight.slug}`} className="collection-spotlight group flex min-h-[30rem] flex-col justify-end overflow-hidden bg-accent p-6 text-void md:p-10">
            <h3 className="max-w-3xl font-display text-[clamp(4rem,9vw,9rem)] font-bold uppercase leading-[0.74] tracking-[-0.065em]">{spotlight.name}</h3>
            <p className="mt-6 max-w-lg font-mono text-sm font-bold leading-relaxed">{spotlight.description}</p>
            <span className="mt-7 font-mono text-xs font-bold uppercase tracking-[0.08em]">Shop {spotlight.name}</span>
          </Link>

          <div className="grid content-start border-t border-border/50">
            {routes.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.slug}`} className="collection-row group py-6">
                <h3 className="font-display text-[clamp(1.8rem,3.5vw,3.5rem)] font-bold uppercase leading-[0.88] tracking-[-0.04em] text-cream transition-colors group-hover:text-accent">{collection.name}</h3>
                <p className="mt-3 max-w-lg font-mono text-xs leading-relaxed text-muted">{collection.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
