// Shop page: show products published live since this page was built, and hide
// any removed from sale. The server renders and escapes each card.
import { catalogState, hideRetiredCards } from "./catalog-state";

async function updateShop() {
  const state = await catalogState();
  hideRetiredCards(state.retired, state.known);
  const section = document.querySelector<HTMLElement>("[data-live-products]");
  const grid = section?.querySelector<HTMLElement>("[data-live-grid]");
  if (!section || !grid) return;
  const cards = state.products.map((product) => product.card).filter((card): card is string => typeof card === "string");
  if (!cards.length) return;
  grid.innerHTML = cards.join("");
  section.hidden = false;
}
// Garment filter: hides cards of other garment types, then any collection (and its
// jump link) left empty. Removed products stay hidden either way.
let garment = "all";
function applyFilter() {
  document.querySelectorAll<HTMLElement>("article.product-card").forEach((card) => card.classList.toggle("is-filtered", garment !== "all" && card.dataset.type !== garment));
  document.querySelectorAll<HTMLElement>(".collection-group").forEach((group) => {
    const empty = garment !== "all" && ![...group.querySelectorAll<HTMLElement>("article.product-card")].some((card) => !card.hidden && !card.classList.contains("is-filtered"));
    group.classList.toggle("is-filtered", empty);
    const heading = group.getAttribute("aria-labelledby");
    if (heading) document.querySelectorAll(`[data-jump="${heading}"]`).forEach((link) => link.classList.toggle("is-filtered", empty));
  });
}
const filter = document.querySelector<HTMLElement>("[data-type-filter]");
if (filter) {
  filter.hidden = false;
  filter.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-filter]");
    if (!button) return;
    garment = button.dataset.filter ?? "all";
    filter.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    applyFilter();
  });
}
void updateShop().then(applyFilter);
