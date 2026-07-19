/** Square variation labels may include a color before the apparel size. */
export function extractVariationSize(name: string): string {
  return name.split(/\s*(?:\/|,)\s*/).pop()?.trim().toUpperCase() || name.trim().toUpperCase();
}

/**
 * Color portion of a "Color / Size" (or "Color, Size") variation label. Returns
 * "" when the label carries only a size (no separator) — e.g. preview-catalog
 * variations and single-color products.
 */
export function extractVariationColor(name: string): string {
  const parts = name.split(/\s*(?:\/|,)\s*/);
  return parts.length > 1 ? parts.slice(0, -1).join(" / ").trim() : "";
}

export interface VariationColorGroups<T> {
  /** true only when EVERY variation carries a color and there are ≥2 distinct colors */
  enabled: boolean;
  /** insertion-ordered distinct color names (empty when not enabled) */
  colors: string[];
  /** color name -> its variations, in original order */
  byColor: Map<string, T[]>;
}

/**
 * Group variations by their color prefix so a PDP can show only the sizes that
 * exist for the selected color. Deliberately conservative: filtering is
 * `enabled` only when the grouping is unambiguous (every variation has a color,
 * ≥2 colors). When disabled the caller must fall back to showing all variations,
 * guaranteeing the size list is never empty.
 */
export function groupVariationsByColor<T extends { name: string }>(variations: T[]): VariationColorGroups<T> {
  const byColor = new Map<string, T[]>();
  const colors: string[] = [];
  let everyHasColor = true;

  for (const v of variations) {
    const color = extractVariationColor(v.name);
    if (!color) {
      everyHasColor = false;
      continue;
    }
    if (!byColor.has(color)) {
      byColor.set(color, []);
      colors.push(color);
    }
    byColor.get(color)!.push(v);
  }

  const enabled = everyHasColor && colors.length >= 2;
  return enabled ? { enabled, colors, byColor } : { enabled: false, colors: [], byColor: new Map() };
}
