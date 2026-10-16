// Shop page: show products published live since this page was built, and hide
// any removed from sale. The server renders and escapes each card.
import { catalogState, hideRetiredCards } from "./catalog-state";

async function updateShop() {
  const state = await catalogState();
  hideRetiredCards(state.retired);
  const section = document.querySelector<HTMLElement>("[data-live-products]");
  const grid = section?.querySelector<HTMLElement>("[data-live-grid]");
  if (!section || !grid) return;
  const cards = state.products.map((product) => product.card).filter((card): card is string => typeof card === "string");
  if (!cards.length) return;
  grid.innerHTML = cards.join("");
  section.hidden = false;
}
void updateShop();
