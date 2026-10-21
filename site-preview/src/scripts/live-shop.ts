import { query, queryAll } from "./dom";
// Shop page: show products published live since this page was built, and hide
// any removed from sale. The server renders and escapes each card.
import { catalogState, hideRetiredCards } from "./catalog-state";
import { GARMENT_GROUPS } from "../../server/catalog/garments.mjs";

async function updateShop() {
  const state = await catalogState();
  const grid = query<HTMLElement>(document, '[data-shop-grid="light"]');
  const layers = query<HTMLElement>(document, '[data-shop-grid="layers"]');
  if (!grid || !layers) return;
  const cards = state.products.map((product) => product.card).filter((card): card is string => typeof card === "string");
  grid.insertAdjacentHTML("beforeend", cards.join(""));
  // New pieces join their garment style instead of jumping above the first tees.
  const rank = (card: HTMLElement) => {
    const index = GARMENT_GROUPS.findIndex(group => group.key === card.dataset.type);
    return index < 0 ? GARMENT_GROUPS.length : index;
  };
  const ordered = [...queryAll<HTMLElement>(document, "[data-shop-grid] article.product-card")].sort((a, b) => rank(a) - rank(b));
  ordered.forEach(card => (rank(card) < 2 ? grid : layers).append(card));
  hideRetiredCards(state.retired, state.known);
}
// Garment filter: hides cards of other garment types, then any collection (and its
// jump link) left empty. Removed products stay hidden either way.
const params = new URLSearchParams(location.search);
let garment = params.get("type") ?? "all";
const searchField = query<HTMLInputElement>(document, "#shop-query");
if (searchField) searchField.value = params.get("q") ?? "";
const resultStatus = query<HTMLElement>(document, "[data-shop-status]");
function applyFilter() {
  queryAll<HTMLElement>(document, "article.product-card").forEach((card) => card.classList.toggle("is-filtered", (garment !== "all" && card.dataset.type !== garment) || !(searchField?.value.trim().toLowerCase().split(/\s+/).every(word => card.textContent?.toLowerCase().includes(word)) ?? true)));
  const count = [...queryAll<HTMLElement>(document, "article.product-card")].filter(card => !card.hidden && !card.classList.contains("is-filtered")).length;
  queryAll<HTMLElement>(document, '[data-shop-grid]').forEach(grid => { grid.hidden = !grid.querySelector('article:not([hidden]):not(.is-filtered)'); });
  if (resultStatus) resultStatus.textContent = count ? `${count} ${count === 1 ? 'piece' : 'pieces'}` : 'No pieces found. Try another garment, color or design.';
  const url = new URL(location.href);
  if (garment === 'all') url.searchParams.delete('type'); else url.searchParams.set('type', garment);
  if (searchField?.value.trim()) url.searchParams.set('q', searchField.value.trim()); else url.searchParams.delete('q');
  history.replaceState(null, '', url);

}
const filter = query<HTMLElement>(document, "[data-type-filter]");
if (filter) {
  filter.hidden = false;
  const options = [...queryAll<HTMLButtonElement>(filter, 'button[data-filter]')];
  if (!options.some(button => button.dataset.filter === garment)) garment = 'all';
  options.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === garment)));
  filter.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-filter]");
    if (!button) return;
    garment = button.dataset.filter ?? "all";
    queryAll(filter, "button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    applyFilter();
  });
}
// The built catalog can be filtered immediately, even on a slow catalog request.
// Filter again when newly published or retired pieces arrive.
applyFilter();
void updateShop().then(applyFilter);

searchField?.addEventListener("input", applyFilter);
query(document, ".shop-search")?.addEventListener("submit", event => { event.preventDefault(); applyFilter(); });
