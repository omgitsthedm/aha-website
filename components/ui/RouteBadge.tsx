import { getCollectionCode, type CollectionCode, DEFAULT_COLLECTION_CODE } from "@/lib/utils/collection-codes";

interface RouteBadgeProps {
  slug?: string;
  code?: CollectionCode;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  tone?: "default" | "inverse";
  className?: string;
}

const sizes = {
  sm: "min-h-7 px-2 text-[10px]",
  md: "min-h-8 px-2.5 text-xs",
  lg: "min-h-10 px-3 text-sm",
};

export function RouteBadge({ slug, code, size = "md", showName = false, tone = "default", className = "" }: RouteBadgeProps) {
  const resolved = code || (slug ? getCollectionCode(slug) : DEFAULT_COLLECTION_CODE);
  const badgeTone = tone === "inverse" ? "border-void text-void" : "border-accent text-accent";
  const nameTone = tone === "inverse" ? "text-void" : "text-muted";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`${sizes[size]} ${badgeTone} inline-flex items-center border font-mono font-bold uppercase tracking-[0.06em]`}>
        {resolved.abbr}
      </span>
      {showName && <span className={`font-mono text-xs ${nameTone}`}>{resolved.name}</span>}
    </span>
  );
}
