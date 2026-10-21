// Size matching for the fit profile: the visitor's own top (laid flat) against the
// finished-garment measurements on a product page. Pure, so it can be unit-tested.
export type Fit = { chest: number; length: number };
export type SizeRow = { size: string; chest: number; length: number };

/**
 * The smallest size at least as wide across the chest as the visitor's own top.
 * A flat garment comparison cannot promise a body fit, so an out-of-range top
 * has no recommendation rather than a misleading largest-size fallback.
 */
export function recommendSize(rows: SizeRow[], fit: Fit) {
  const roomy = rows.filter((row) => row.chest - fit.chest >= -0.25).sort((a, b) => a.chest - b.chest);
  return roomy[0] ?? null;
}
