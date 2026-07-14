import type { ReactNode } from "react";
import { swatchesFor } from "@/lib/data/color-swatches";

/**
 * Small row of colorway dots for a shop card. Shows up to `max` swatches, then
 * a "+N" for the rest. When we have no confident swatches it renders `fallback`
 * (e.g. the "N colors" text) — so a card never shows a wrong or placeholder
 * color. Server-safe (no client JS).
 */
export function ColorSwatches({
  colors,
  max = 5,
  className = "",
  fallback = null,
}: {
  colors: string[];
  max?: number;
  className?: string;
  fallback?: ReactNode;
}) {
  const swatches = swatchesFor(colors);
  if (swatches.length === 0) return <>{fallback}</>;

  const shown = swatches.slice(0, max);
  const extra = swatches.length - shown.length;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label={`Available in ${swatches.map((s) => s.name).join(", ")}`}
    >
      {shown.map((s) => (
        <span
          key={s.hex}
          title={s.name}
          className="h-3 w-3 rounded-full border border-border/40"
          style={{ backgroundColor: s.hex }}
        />
      ))}
      {extra > 0 && (
        <span className="ml-0.5 font-mono text-[10px] font-bold text-muted">+{extra}</span>
      )}
    </span>
  );
}
