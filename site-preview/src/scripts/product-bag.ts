import { query, queryAll } from "./dom";
import { deliveryLines } from "./delivery";

const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// After "Add to bag": a card in the corner (a sheet on phones) with the piece, the
// bag subtotal and Checkout. It never blocks the page: Escape, Close, Keep shopping
// or a click elsewhere puts it away, and focus returns where it was.
let bagPanel: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;
function closeBagPanel() {
  if (!bagPanel || bagPanel.hidden) return;
  bagPanel.hidden = true;
  returnFocus?.focus({ preventScroll: true });
}
export type BagAdded = { title: string; size: string; image: string; added: number; lineCents: number; items: number; subtotalCents: number };
export function showBagPanel({ title, size, image, added, lineCents, items, subtotalCents }: BagAdded) {
  if (!bagPanel) {
    bagPanel = document.createElement("section");
    bagPanel.className = "bag-panel";
    bagPanel.tabIndex = -1;
    bagPanel.setAttribute("aria-labelledby", "bag-panel-title");
    bagPanel.append(query<HTMLTemplateElement>(document, "#bag-content")!.content.cloneNode(true));
    document.body.append(bagPanel);
    queryAll(bagPanel, "[data-close]").forEach((button) => button.addEventListener("click", closeBagPanel));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeBagPanel(); });
    document.addEventListener("pointerdown", (event) => {
      const target = event.target as Element;
      if (bagPanel && !bagPanel.contains(target) && !target.closest?.("[data-cart-form], .buy-bar")) closeBagPanel();
    });
  }
  query(bagPanel, "img")!.src = image;
  const [name, detail, price] = queryAll<HTMLElement>(bagPanel, ".bag-panel-item strong, .bag-panel-item span");
  name!.textContent = title;
  detail!.textContent = `Size ${size} · Qty ${added}`;
  price!.textContent = MONEY.format(lineCents / 100);
  query(bagPanel, ".bag-panel-total span")!.textContent = `Bag subtotal · ${items} ${items === 1 ? "item" : "items"}`;
  query(bagPanel, ".bag-panel-total strong")!.textContent = MONEY.format(subtotalCents / 100);
  query(bagPanel, ".bag-panel-arrival")!.textContent = deliveryLines()[0]!;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  bagPanel.hidden = false;
  bagPanel.focus({ preventScroll: true });
}

