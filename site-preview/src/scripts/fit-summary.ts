import type { Fit, SizeRow } from "./fit";

const inches = (difference: number) => Math.abs(Math.round(difference * 4) / 4);

export function fitSummary(row: SizeRow, fit: Fit) {
  const chest = row.chest - fit.chest;
  const length = row.length - fit.length;
  const width = Math.abs(chest) < 0.25 ? "the same width across the chest" : `${inches(chest)} in ${chest > 0 ? "roomier" : "narrower"} across the chest`;
  const height = Math.abs(length) < 0.25 ? "the same length" : `${inches(length)} in ${length > 0 ? "longer" : "shorter"}`;
  return `Closest width: ${row.size} is ${width} and ${height}. Length describes the garment's cut; it does not change this width comparison.`;
}
