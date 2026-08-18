/**
 * Square item names carry the garment as a suffix ("No Kings — Tee") so the
 * catalog stays unambiguous. The storefront shows the piece by its name and
 * the garment as a quiet second line — a label names its work, not its blank.
 */
export function splitProductName(fullName: string): { name: string; garment: string | null } {
  const [name, ...rest] = fullName.split(/\s+—\s+/);
  const garment = rest.join(" — ").trim();
  return { name: name.trim(), garment: garment || null };
}
