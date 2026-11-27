import plan from "../data/sale.json" with { type: "json" };

// The storewide sale (src/data/sale.json). The checkout server reads the same file
// and decides what is charged; these only show shoppers what to expect.
export type Sale = { percent: number; label: string; until: string; code: string };

export function currentSale(now = Date.now()): Sale | null {
  return now >= Date.parse(plan.startsAt) && now < Date.parse(plan.endsAt) ? plan : null;
}

/** While the sale runs, the header's middle line names it and links to the shop. */
export function showSaleBar(sale: Sale | null = currentSale()) {
  const slot = document.querySelector(".benefit-bar span");
  if (!slot || !sale) return;
  const link = document.createElement("a");
  link.href = "/shop/";
  link.className = "benefit-sale";
  link.textContent = `${sale.percent}% off · code ${sale.code}`;
  slot.replaceWith(link);
}
