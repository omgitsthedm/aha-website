import { getLineForCollection, type SubwayLine, DEFAULT_LINE } from "@/lib/utils/subway-lines";

interface RouteBadgeProps {
  slug?: string;
  line?: SubwayLine;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizes = {
  sm: { circle: "w-5 h-5", text: "text-[9px]", name: "text-[10px]" },
  md: { circle: "w-6 h-6", text: "text-[10px]", name: "text-xs" },
  lg: { circle: "w-8 h-8", text: "text-xs", name: "text-sm" },
};

export function RouteBadge({
  slug,
  line,
  size = "md",
  showName = false,
  className = "",
}: RouteBadgeProps) {
  const resolvedLine = line || (slug ? getLineForCollection(slug) : DEFAULT_LINE);
  const s = sizes[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${s.circle} rounded-full inline-flex items-center justify-center font-mono font-medium ${s.text} leading-none flex-shrink-0`}
        style={{ backgroundColor: resolvedLine.color, color: resolvedLine.color === "#FCCC0A" ? "#141414" : "#FFFFFF" }}
        aria-label={resolvedLine.name}
      >
        {resolvedLine.abbr}
      </span>
      {showName && (
        <span className={`font-mono ${s.name} text-muted`}>
          {resolvedLine.name}
        </span>
      )}
    </span>
  );
}
