import manifest from "@/public/editorial/opt/manifest.json";

export interface OptimizedEditorial {
  /** File stem under /editorial/opt/, e.g. `hero-her` → `hero-her-750.avif`. */
  name: string;
  /** Encoded widths, ascending. */
  widths: number[];
  width: number;
  height: number;
}

const OPTIMIZED = manifest as Record<string, OptimizedEditorial>;

/**
 * Pre-encoded AVIF/WebP renditions for an editorial image, keyed by its
 * `/editorial/...` src. Produced by `node scripts/imagery/encode-editorial.mjs`;
 * a src without an entry falls back to the on-demand optimizer.
 */
export function getOptimizedEditorial(src: string): OptimizedEditorial | undefined {
  return OPTIMIZED[src];
}

export function optimizedSrcSet(entry: OptimizedEditorial, format: "avif" | "webp"): string {
  return entry.widths.map((width) => `/editorial/opt/${entry.name}-${width}.${format} ${width}w`).join(", ");
}
