import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { COLLECTION_CODES } from "@/lib/utils/collection-codes";

export function Collections({ collections }: { collections: Collection[] }) {
  const visible = collections.filter((collection) => collection.slug in COLLECTION_CODES);
  if (visible.length === 0) return null;
  return (
    <section className="relative z-[2] px-4 py-16 md:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 max-w-2xl border-t-2 border-accent pt-5">
          <h2 className="font-display text-[clamp(2.5rem,6vw,5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Shop by collection</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted">Start with the idea, then find the piece.</p>
        </div>
        <div className="grid gap-px border border-border/40 bg-border/40 md:grid-cols-2">
          {visible.map((collection) => (
            <Link key={collection.id} href={`/collections/${collection.slug}`} className="group bg-void p-5 transition-colors hover:bg-charcoal md:p-7">
              <RouteBadge slug={collection.slug} size="sm" />
              <h3 className="mt-5 font-display text-2xl font-black uppercase leading-none tracking-[-0.04em] text-cream group-hover:text-accent">{collection.name}</h3>
              <p className="mt-3 max-w-xl font-mono text-sm leading-relaxed text-muted">{collection.description}</p>
              <span className="mt-5 inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase text-accent underline underline-offset-4">Shop {collection.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
