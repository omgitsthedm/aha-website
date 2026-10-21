import { query, queryAll } from "./dom";
import { catalogState, hideRetiredCards } from "./catalog-state";
import { GARMENT_GROUPS } from "../../server/catalog/garments.mjs";
import { matchesSearch as queryMatches, searchEventDispatcher, searchTerms } from "./search";

const params = new URLSearchParams(location.search);
let garment = params.get("type") ?? "all";
let size = params.get("size") ?? "all";
let color = params.get("color") ?? "all";
const searchField = query<HTMLInputElement>(document, "#shop-query");
const resultStatus = query<HTMLElement>(document, "[data-shop-status]");
const typeFilter = query<HTMLElement>(document, "[data-type-filter]");
const sizeFilter = query<HTMLElement>(document, "[data-size-filter]");
const colorFilter = query<HTMLSelectElement>(document, "[data-color-filter]");
const refine = query<HTMLElement>(document, "[data-shop-refine]");
const reset = query<HTMLButtonElement>(document, "[data-shop-reset]");

if (searchField) searchField.value = params.get("q") ?? "";
if (colorFilter && [...colorFilter.options].some((option) => option.value === color)) colorFilter.value = color;
else color = "all";

const cards = () => [...queryAll<HTMLElement>(document, "article.product-card")];
const values = (card: HTMLElement, name: "colors" | "sizes" | "color") => (card.dataset[name] ?? "").split("|").filter(Boolean);
const reportShopSearch = searchEventDispatcher("shop");

function groupColorFamilies() {
  const families = new Map<string, HTMLElement[]>();
  cards().forEach((card) => {
    card.classList.remove("is-color-variant");
    query(card, "[data-color-family]")?.remove();
    const family = card.dataset.family;
    if (family) families.set(family, [...(families.get(family) ?? []), card]);
  });
  for (const family of families.values()) {
    const available = family.filter((card) => !card.hidden && !card.classList.contains("is-filtered"));
    if (available.length < 2) continue;
    const lead = available[0]!;
    lead.dataset.colors = available.map((card) => card.dataset.color ?? "").join("|");
    lead.dataset.sizes = [...new Set(available.flatMap((card) => values(card, "sizes")))].join("|");
    const row = document.createElement("p");
    row.className = "color-family";
    row.dataset.colorFamily = "";
    row.append(`${available.length} colors`);
    available.forEach((card) => {
      const link = document.createElement("a");
      link.href = query<HTMLAnchorElement>(card, ".product-card-image")?.getAttribute("href") ?? "/shop/";
      link.setAttribute("aria-label", `View ${card.dataset.color} color`);
      const swatch = document.createElement("span");
      swatch.style.setProperty("--swatch", card.dataset.swatch ?? "#eae6db");
      swatch.setAttribute("aria-hidden", "true");
      link.append(swatch);
      row.append(link);
    });
    query(lead, ".product-card-info")?.append(row);
    available.slice(1).forEach((card) => card.classList.add("is-color-variant"));
  }
}

function updateControls() {
  if (typeFilter) queryAll<HTMLButtonElement>(typeFilter, "button[data-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === garment)));
  if (sizeFilter) queryAll<HTMLButtonElement>(sizeFilter, "button[data-size]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.size === size)));
  if (colorFilter) colorFilter.value = color;
  if (reset) reset.hidden = garment === "all" && size === "all" && color === "all" && !searchField?.value.trim();
}

function updateUrl() {
  const url = new URL(location.href);
  for (const [key, value] of [["type", garment], ["size", size], ["color", color], ["q", searchField?.value.trim() ?? ""]] as const) {
    if (!value || value === "all") url.searchParams.delete(key); else url.searchParams.set(key, value);
  }
  history.replaceState(null, "", url);
}

function setStatus(count: number) {
  if (!resultStatus) return;
  resultStatus.replaceChildren(`${count} ${count === 1 ? "piece" : "pieces"}`);
  const supportTerms = searchTerms(searchField?.value ?? "");
  if (count || !supportTerms.some((term) => ["return", "returns", "shipping", "support", "contact", "help"].includes(term))) return;
  resultStatus.append(". Need help? ");
  [["Returns", "/returns/"], ["Shipping", "/shipping/"], ["Contact", "/contact/"]].forEach(([label, href], index) => {
    if (index) resultStatus.append(" · ");
    resultStatus.append(Object.assign(document.createElement("a"), { textContent: label, href }));
  });
}

function applyFilter(reportSearch = false) {
  const search = searchField?.value ?? "";
  cards().forEach((card) => {
    const matchesQuery = queryMatches(card.textContent ?? "", search);
    const matchesType = garment === "all" || card.dataset.type === garment;
    const matchesSize = size === "all" || values(card, "sizes").includes(size);
    const matchesColor = color === "all" || card.dataset.color === color;
    card.classList.toggle("is-filtered", !matchesQuery || !matchesType || !matchesSize || !matchesColor);
  });
  groupColorFamilies();
  const visible = cards().filter((card) => !card.hidden && !card.classList.contains("is-filtered") && !card.classList.contains("is-color-variant"));
  queryAll<HTMLElement>(document, "[data-shop-grid]").forEach((grid) => { grid.hidden = !grid.querySelector("article:not([hidden]):not(.is-filtered):not(.is-color-variant)"); });
  setStatus(visible.length);
  updateControls();
  updateUrl();
  if (reportSearch) reportShopSearch(search, visible.length);
}

async function updateShop() {
  const state = await catalogState();
  const light = query<HTMLElement>(document, '[data-shop-grid="light"]');
  const layers = query<HTMLElement>(document, '[data-shop-grid="layers"]');
  if (!light || !layers) return;
  const fresh = state.products.map((product) => product.card).filter((card): card is string => typeof card === "string");
  light.insertAdjacentHTML("beforeend", fresh.join(""));
  const rank = (card: HTMLElement) => {
    const index = GARMENT_GROUPS.findIndex((group) => group.key === card.dataset.type);
    return index < 0 ? GARMENT_GROUPS.length : index;
  };
  cards().sort((a, b) => rank(a) - rank(b)).forEach((card) => (rank(card) < 2 ? light : layers).append(card));
  hideRetiredCards(state.retired, state.known);
}

if (typeFilter) {
  typeFilter.hidden = false;
  if (!["all", ...Array.from(queryAll<HTMLButtonElement>(typeFilter, "button[data-filter]"), (button) => button.dataset.filter ?? "")].includes(garment)) garment = "all";
  typeFilter.addEventListener("click", (event) => { const button = (event.target as Element).closest<HTMLButtonElement>("button[data-filter]"); if (button) { garment = button.dataset.filter ?? "all"; applyFilter(); } });
}
if (sizeFilter) {
  sizeFilter.hidden = false;
  if (!["all", ...Array.from(queryAll<HTMLButtonElement>(sizeFilter, "button[data-size]"), (button) => button.dataset.size ?? "")].includes(size)) size = "all";
  sizeFilter.addEventListener("click", (event) => { const button = (event.target as Element).closest<HTMLButtonElement>("button[data-size]"); if (button) { size = button.dataset.size ?? "all"; applyFilter(); } });
}
if (refine) refine.hidden = false;
colorFilter?.addEventListener("change", () => { color = colorFilter.value; applyFilter(); });
reset?.addEventListener("click", () => { garment = size = color = "all"; if (searchField) searchField.value = ""; applyFilter(); });
searchField?.addEventListener("input", () => applyFilter(true));
query(document, ".shop-search")?.addEventListener("submit", (event) => { event.preventDefault(); applyFilter(); });
applyFilter();
void updateShop().then(() => applyFilter());
window.addEventListener("pageshow", () => applyFilter());
