import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";

interface CollectionsProps {
  collections: Collection[];
}

export function Collections({ collections }: CollectionsProps) {
  if (collections.length === 0) return null;

  // Only show collections that have a subway line mapping
  const lined = collections.filter((c) => c.slug in SUBWAY_LINES);

  return (
    <section className="py-24 md:py-32 px-6 bg-void">
      <WhiteBand />

      <div className="max-w-3xl mx-auto">
        <span className="font-mono text-[11px] text-muted uppercase tracking-[0.2em] block mb-8">
          The Lines
        </span>

        {lined.map((col, i) => (
          <div key={col.id}>
            <Link
              href={`/collections/${col.slug}`}
              className="group flex items-center gap-4 py-5 hover:bg-[#1A1918] transition-colors -mx-4 px-4"
            >
              <RouteBadge slug={col.slug} size="lg" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm text-cream group-hover:text-white transition-colors">
                  {col.name}
                </span>
                <span className="block font-body text-xs text-muted mt-0.5 truncate">
                  {col.description}
                </span>
              </div>
              <span className="font-mono text-xs text-muted group-hover:text-white transition-colors">
                Explore &rarr;
              </span>
            </Link>
            <WhiteBand />
          </div>
        ))}
      </div>
    </section>
  );
}
