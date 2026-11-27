import schedule from "../../src/data/sale.json" with { type: "json" };

// The storewide sale (src/data/sale.json): one percentage off every piece for a set
// window. The checkout server and the storefront script (src/scripts/sale.ts) read
// the same file, so the bag never shows a price the quote won't charge. `endsAt` is
// midnight in Hawaii, so "through Nov. 30" holds in every U.S. time zone.

/** The sale in force at `nowMs`, or null. A malformed schedule means no sale. */
export function saleAt(nowMs, plan = schedule) {
  const from = Date.parse(plan?.startsAt);
  const until = Date.parse(plan?.endsAt);
  const label = typeof plan?.label === "string" ? plan.label.trim() : "";
  if (!Number.isInteger(plan?.percent) || plan.percent < 1 || plan.percent > 90 || !label || !Number.isFinite(from) || !Number.isFinite(until)) return null;
  return nowMs >= from && nowMs < until ? Object.freeze({ percent: plan.percent, label }) : null;
}

export function discountForCode(nowMs, code, plan = schedule) {
  const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
  return normalized && normalized === plan?.code ? saleAt(nowMs, plan) : null;
}

/** What the sale takes off these priced lines, each line rounded to the cent. */
export function saleCents(items, sale) {
  return sale ? items.reduce((sum, item) => sum + Math.round((item.totalAmount * sale.percent) / 100), 0) : 0;
}
