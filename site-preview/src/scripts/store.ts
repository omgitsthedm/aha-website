export interface BagLine {
  id: string;
  quantity: number;
}
export interface Buyable {
  variants: { id: string; available: number; price: number }[];
}
export function cleanBag(value: unknown, products: Buyable[]): BagLine[] {
  if (!Array.isArray(value)) return [];
  const variants = new Map(
    products.flatMap((p) => p.variants).map((v) => [v.id, v]),
  );
  const output = new Map<string, number>();
  for (const row of value.slice(0, 50)) {
    if (!row || typeof row !== "object") continue;
    const variant = variants.get(row.id);
    if (!variant || !Number.isInteger(row.quantity) || row.quantity < 1)
      continue;
    output.set(
      row.id,
      Math.min(10, variant.available, (output.get(row.id) || 0) + row.quantity),
    );
  }
  return [...output]
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ id, quantity }));
}
export function cleanSaved(value: unknown, slugs: string[]): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (v): v is string => typeof v === "string" && slugs.includes(v),
          ),
        ),
      ].slice(0, 50)
    : [];
}
