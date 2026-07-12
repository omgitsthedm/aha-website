import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { COLLECTION_CODES } from "@/lib/utils/collection-codes";

export function Collections({ collections }: { collections: Collection[] }) {
  const visible = collections.filter((collection) => collection.slug in COLLECTION_CODES);
  if (visible.length === 0) return null;
  const spotlight = visible.find((collection) => collection.slug === "black-sheep") || visible[0];
  const routes = visible.filter((collection) => collection.id !== spotlight.id);
  return (
    <section className="relative z-[2] px-4 py-16 md:px-6 md:py-28">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-display text-[clamp(2.7rem,6vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em]">Choose a point of view</h2>
          <p className="mt-4 font-mono text-sm leading-relaxed text-muted">Collections organize the catalog by idea, not by trend.</p>
        </div>
        <div className="grid gap-px border border-border/40 bg-border/40 lg:grid-cols-[1.15fr_0.85fr]">
          <Link href={`/collections/${spotlight.slug}`} className="group flex min-h-[26rem] flex-col justify-between bg-accent p-6 text-void md:p-10">
            <RouteBadge slug={spotlight.slug} size="md" showName tone="inverse" />
            <div>
              <h3 className="max-w-2xl font-display text-[clamp(3.5rem,8vw,8rem)] font-black uppercase leading-[0.78] tracking-[-0.075em]">{spotlight.name}</h3>
              <p className="mt-6 max-w-xl font-mono text-sm font-bold leading-relaxed">{spotlight.description}</p>
              <span className="mt-6 inline-flex min-h-11 items-center border border-void px-4 py-3 font-mono text-xs font-bold uppercase transition-colors group-hover:bg-void group-hover:text-accent">Shop the collection</span>
            </div>
          </Link>
          <div className="grid bg-border/40">
            {routes.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.slug}`} className="group grid min-h-20 grid-cols-[auto_1fr] items-center gap-4 bg-void px-5 py-4 transition-colors hover:bg-charcoal md:px-7">
                <RouteBadge slug={collection.slug} size="sm" />
                <div className="min-w-0">
                  <h3 className="break-words font-display text-lg font-black uppercase leading-none tracking-[-0.035em] text-cream group-hover:text-accent">{collection.name}</h3>
                  <p className="mt-2 line-clamp-2 font-mono text-xs leading-relaxed text-muted">{collection.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
