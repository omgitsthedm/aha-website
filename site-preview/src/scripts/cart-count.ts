const STORAGE_KEY = "aha-cart-v2";

function countSavedLines() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.reduce((total, line) => total + (Number.isInteger(line?.quantity) && line.quantity > 0 ? line.quantity : 0), 0)
      : 0;
  } catch { return 0; }
}
function update() {
  const count = countSavedLines();
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((node) => node.textContent = String(count));
  document.querySelectorAll<HTMLAnchorElement>("[data-cart-link]").forEach((node) => node.setAttribute("aria-label", `Bag, ${count} ${count === 1 ? "item" : "items"}`));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", update, { once: true }); else update();
window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) update(); });
