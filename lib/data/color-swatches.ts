/**
 * Colorway name → representative swatch hex, for the swatch dots on shop cards.
 * Values approximate the real blank garment colors (Bella+Canvas / Next Level /
 * Comfort Colors / Gildan lines) — accurate enough to read at a glance, not a
 * fabric proof. Keyed by the exact color names in `data/product-manifest.json`.
 *
 * A dot is a helpful cue, never a promise: the PDP still names every color, and
 * the real garment photography is the source of truth. Unknown names resolve to
 * `null` and simply render no dot (never a wrong or misleading color).
 */
const SWATCH_HEX: Record<string, string> = {
  berry: "#8E3B5A",
  black: "#1B1B1B",
  blossom: "#E8B7C4",
  "burnt orange": "#B5561E",
  "chalky mint": "#B9D9C7",
  chambray: "#6E8CA8",
  "charcoal black triblend": "#2E2E2E",
  "charcoal heather": "#4A4A4A",
  crimson: "#A5203A",
  crunchberry: "#C6295B",
  "flo blue": "#2F6DB5",
  graphite: "#3A3A3C",
  "grey triblend": "#8C8C8C",
  "heather grey": "#B2B2B2",
  "ice blue": "#C4D8E8",
  ivory: "#F3EEE1",
  maroon: "#6E1E2A",
  "midnight navy": "#1E2A3A",
  moss: "#5A6B3B",
  mustard: "#C99A2E",
  "mystic blue": "#4E6E8E",
  navy: "#23304A",
  "navy blazer": "#21283B",
  paprika: "#B4432A",
  pepper: "#4B4B49",
  purple: "#5B2A83",
  red: "#C0202E",
  "royal blue": "#2A4DA0",
  seafoam: "#9BD3C0",
  "team royal": "#2B4C9B",
  "true navy": "#1F2A44",
  turquoise: "#2CA6A4",
  violet: "#6E4B9E",
  white: "#F5F5F0",
};

/** Resolve a color name to a swatch hex, or null if we don't have a confident
 *  match (leaked size values like "S"/"L", or anything unmapped). */
export function swatchHex(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (!key || key.length < 3) return null; // drops leaked size tokens ("s","l","xl")
  return SWATCH_HEX[key] ?? null;
}

/** Map a list of color names to their swatches, dropping unknowns. Preserves
 *  order and de-dupes identical hexes so near-duplicate names show once. */
export function swatchesFor(names: string[]): { name: string; hex: string }[] {
  const seen = new Set<string>();
  const out: { name: string; hex: string }[] = [];
  for (const name of names) {
    const hex = swatchHex(name);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    out.push({ name, hex });
  }
  return out;
}
