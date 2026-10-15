export interface SelectionVariant {
  id: string;
  sku: string;
  size: string;
  slug: string;
  title: string;
  price: number;
}

export function recoverSelection(search: string, variants: SelectionVariant[]) {
  const params = new URLSearchParams(search);
  const raw = params.get('products') || '';
  const lines: (SelectionVariant & { quantity: number })[] = [];
  const byId = new Map(variants.flatMap(v => [[v.id, v], [v.sku, v]] as const));
  let incomplete = raw.length > 4096;
  if (!incomplete && raw) {
    for (const entry of raw.split(',')) {
      const [id, amount, extra] = entry.split(':');
      const hit = byId.get(id || '');
      const quantity = Number(amount);
      if (!hit || extra !== undefined || !/^\d+$/.test(amount || '') || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
        incomplete = true;
        continue;
      }
      const previous = lines.find(line => line.id === hit.id);
      if (previous) {
        if (previous.quantity + quantity > 20) { incomplete = true; continue; }
        previous.quantity += quantity;
      } else lines.push({ ...hit, quantity });
    }
  }
  return { lines, incomplete, coupon: (params.get('coupon') || '').slice(0, 80) };
}
