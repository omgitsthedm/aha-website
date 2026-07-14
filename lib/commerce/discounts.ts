/**
 * Promo-code discounts. The code + percentage live ONLY in server env, so the
 * client can never forge the amount — it sends a code string, the server decides
 * what (if anything) it's worth. Resolved identically on the quote and the charge
 * so the QUOTE_CHANGED guard still holds.
 *
 * Configure in the Netlify dashboard (all optional — unset = no discounts):
 *   PROMO_CODE    e.g. "FIRST10"      (case-insensitive)
 *   PROMO_PERCENT e.g. "10"           (1–99)
 *   PROMO_LABEL   e.g. "First order"  (shown to the shopper)
 *
 * NOTE: this applies to anyone with the code (rotate/retire it to control reach).
 * True one-per-customer "first order" enforcement (email lookup) is a follow-up.
 */
export interface OrderDiscount {
  name: string;
  /** Square order-discount percentage, as a string like "10". */
  percentage: string;
}

export function resolveDiscount(code?: string | null): OrderDiscount | null {
  if (!code) return null;
  const configured = (process.env.PROMO_CODE || "").trim().toUpperCase();
  const percent = Number.parseInt(process.env.PROMO_PERCENT || "0", 10);
  if (!configured) return null;
  if (!Number.isInteger(percent) || percent <= 0 || percent >= 100) return null;
  if (code.trim().toUpperCase() !== configured) return null;
  return { name: process.env.PROMO_LABEL || "Promo", percentage: String(percent) };
}
