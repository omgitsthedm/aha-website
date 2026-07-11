import { getCollectionCode, type CollectionCode, DEFAULT_COLLECTION_CODE } from "@/lib/utils/collection-codes";

interface RouteBadgeProps {
  slug?: string;
  code?: CollectionCode;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizes = {
  sm: "min-h-7 px-2 text-[10px]",
  md: "min-h-8 px-2.5 text-xs",
  lg: "min-h-10 px-3 text-sm",
};

export function RouteBadge({ slug, code, size = "md", showName = false, className = "" }: RouteBadgeProps) {
  const resolved = code || (slug ? getCollectionCode(slug) : DEFAULT_COLLECTION_CODE);
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`${sizes[size]} inline-flex items-center border border-accent font-mono font-bold uppercase tracking-[0.06em] text-accent`}>
        {resolved.abbr}
      </span>
      {showName && <span className="font-mono text-xs text-muted">{resolved.name}</span>}
    </span>
  );
}
