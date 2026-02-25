import Link from "next/link";
import type { Collection } from "@/lib/utils/types";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";

interface LineDirectoryProps {
  collections: Collection[];
}

const VALID_SLUGS = new Set(Object.values(SUBWAY_LINES).map((line) => line.slug));

export function LineDirectory({ collections }: LineDirectoryProps) {
  const filtered = collections.filter((col) => VALID_SLUGS.has(col.slug));

  if (filtered.length === 0) return null;

  return (
    <section className="py-8 px-6">
      <WhiteBand />

      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 py-8">
        {filtered.map((col) => (
          <Link
            key={col.slug}
            href={`/collections/${col.slug}`}
            className="opacity-80 hover:opacity-100 transition-opacity"
          >
            <RouteBadge slug={col.slug} size="lg" showName />
          </Link>
        ))}
      </div>

      <WhiteBand />
    </section>
  );
}

export default LineDirectory;
