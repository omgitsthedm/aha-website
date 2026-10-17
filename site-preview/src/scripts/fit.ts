// Size matching for the fit profile: the visitor's own top (laid flat) against the
// finished-garment measurements on a product page. Pure, so it can be unit-tested.
export type Fit = { chest: number; length: number };
export type SizeRow = { size: string; chest: number; length: number };

/** The smallest size at least as wide across the chest as the visitor's own top (or the largest, if none is). */
export function recommendSize(rows: SizeRow[], fit: Fit) {
  const roomy = rows.filter((row) => row.chest - fit.chest >= -0.25).sort((a, b) => a.chest - b.chest);
  return roomy[0] ?? [...rows].sort((a, b) => b.chest - a.chest)[0] ?? null;
}

const inches = (difference: number) => Math.abs(Math.round(difference * 4) / 4);

export function fitSummary(row: SizeRow, fit: Fit) {
  const chest = row.chest - fit.chest;
  const length = row.length - fit.length;
  const width = Math.abs(chest) < 0.25 ? "the same width across the chest" : `${inches(chest)} in ${chest > 0 ? "roomier" : "narrower"} across the chest`;
  const height = Math.abs(length) < 0.25 ? "the same length" : `${inches(length)} in ${length > 0 ? "longer" : "shorter"}`;
  return `Compared with your own top, ${row.size} is ${width} and ${height}.`;
}
