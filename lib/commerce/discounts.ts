/**
 * Promo-code discounts. The code + type live ONLY in server env, so the client
 * can never forge the value — it sends a code string, the server decides what
 * (if anything) it's worth from the cart. Resolved identically on the quote and
 * the charge so the QUOTE_CHANGED guard still holds.
 *
 * Configure in the Netlify dashboard (all optional — unset PROMO_CODE = off):
 *   PROMO_CODE    e.g. "OneOnMe" or "FIRST10"   (case-insensitive)
 *   PROMO_TYPE    "bogo" | "percent"            (default "percent")
 *   PROMO_PERCENT e.g. "10"  (1–99, percent type only)
 *   PROMO_LABEL   e.g. "Buy 1, Get 1 Free"      (shown to the shopper)
 *
 * BOGO = for every 2 items, the cheaper is free (cart-wide: expand units, free
 * the cheapest floor(n/2)). Rotate/retire the code to control reach.
 */
export interface OrderDiscount {
  name: string;
  /** Percentage discount, as a string like "10" (percent type). */
  percentage?: string;
  /** Fixed-amount discount in cents (bogo / computed types). */
  amountMoney?: { amount: number; currency: string };
}

export interface DiscountCartItem {
  unitPrice: number; // cents
  quantity: number;
}
export interface DiscountCart {
  items: DiscountCartItem[];
  currency: string;
}

/** Value of the free items under "buy 1 get 1 free": expand each unit, free the
 *  cheapest floor(n/2). Returns cents (0 when fewer than 2 items). */
export function computeBogoAmount(items: DiscountCartItem[]): number {
  const units: number[] = [];
  for (const it of items) {
    const q = Math.max(0, Math.floor(it.quantity));
    for (let i = 0; i < q; i++) units.push(it.unitPrice);
  }
  if (units.length < 2) return 0;
  units.sort((a, b) => a - b);
  const free = Math.floor(units.length / 2);
  let amount = 0;
  for (let i = 0; i < free; i++) amount += units[i];
  return amount;
}

export function resolveDiscount(code?: string | null, cart?: DiscountCart): OrderDiscount | null {
  if (!code) return null;
  const configured = (process.env.PROMO_CODE || "").trim().toUpperCase();
  if (!configured) return null;
  if (code.trim().toUpperCase() !== configured) return null;

  const type = (process.env.PROMO_TYPE || "percent").trim().toLowerCase();
  const label = process.env.PROMO_LABEL || "Promo";

  if (type === "bogo") {
    if (!cart?.items?.length) return null;
    const amount = computeBogoAmount(cart.items);
    if (amount <= 0) return null; // needs at least a pair
    return { name: label, amountMoney: { amount, currency: cart.currency || "USD" } };
  }

  const percent = Number.parseInt(process.env.PROMO_PERCENT || "0", 10);
  if (!Number.isInteger(percent) || percent <= 0 || percent >= 100) return null;
  return { name: label, percentage: String(percent) };
}

/**
 * Automatic bundle discount — no code needed. When the cart holds at least
 * BUNDLE_MIN_QTY units, take BUNDLE_PERCENT off. Configure in Netlify env
 * (unset BUNDLE_MIN_QTY = off):
 *   BUNDLE_MIN_QTY  e.g. "3"
 *   BUNDLE_PERCENT  e.g. "10"  (1–99)
 *   BUNDLE_LABEL    e.g. "Bundle & save"
 * Reversible instantly by unsetting the env. Resolved identically on quote +
 * charge so the QUOTE_CHANGED guard still holds.
 */
function resolveBundle(cart?: DiscountCart): OrderDiscount | null {
  const minQty = Number.parseInt(process.env.BUNDLE_MIN_QTY || "0", 10);
  const percent = Number.parseInt(process.env.BUNDLE_PERCENT || "0", 10);
  if (!Number.isInteger(minQty) || minQty < 2) return null;
  if (!Number.isInteger(percent) || percent <= 0 || percent >= 100) return null;
  if (!cart?.items?.length) return null;
  const units = cart.items.reduce((sum, i) => sum + Math.max(0, Math.floor(i.quantity)), 0);
  if (units < minQty) return null;
  return { name: process.env.BUNDLE_LABEL || `Bundle: ${minQty}+ items, ${percent}% off`, percentage: String(percent) };
}

/** Cash value (cents) of a discount against the cart, for comparing offers. */
function discountValue(d: OrderDiscount | null, cart?: DiscountCart): number {
  if (!d || !cart?.items?.length) return 0;
  if (d.amountMoney) return d.amountMoney.amount;
  const subtotal = cart.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const pct = Number.parseInt(d.percentage || "0", 10);
  return Number.isInteger(pct) ? Math.round((subtotal * pct) / 100) : 0;
}

/**
 * The single discount actually applied: the BETTER of the promo code and the
 * automatic bundle (never stacks). Both the quote and the charge call this with
 * the same cart, so the totals always match.
 */
export function resolveEffectiveDiscount(code?: string | null, cart?: DiscountCart): OrderDiscount | null {
  const promo = resolveDiscount(code, cart);
  const bundle = resolveBundle(cart);
  if (!promo) return bundle;
  if (!bundle) return promo;
  return discountValue(bundle, cart) > discountValue(promo, cart) ? bundle : promo;
}
