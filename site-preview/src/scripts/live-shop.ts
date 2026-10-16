// Shows products published live since this page was built. The server renders
// and escapes each card; nothing appears if there are none.
async function showLiveProducts() {
  const section = document.querySelector<HTMLElement>("[data-live-products]");
  const grid = section?.querySelector<HTMLElement>("[data-live-grid]");
  if (!section || !grid) return;
  try {
    const response = await fetch("/api/catalog/live", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json() as { products?: Array<{ card?: unknown }> };
    const cards = (data.products ?? []).map((product) => product.card).filter((card): card is string => typeof card === "string");
    if (!cards.length) return;
    grid.innerHTML = cards.join("");
    section.hidden = false;
  } catch { /* built collection only */ }
}
void showLiveProducts();
