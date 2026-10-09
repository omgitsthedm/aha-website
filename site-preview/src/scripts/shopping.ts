import { cleanBag, cleanSaved } from "./store";
import type { Piece } from "../data/catalog";
const node = document.getElementById("shopping-data");
const pieces: Piece[] = node ? JSON.parse(node.textContent || "[]") : [];
const slugs = pieces.map((p) => p.slug);
let storage = true;
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    storage = false;
    return null;
  }
}
let saved = cleanSaved(read("aha:saved:v2"), slugs);
let bag = cleanBag(read("aha:bag:v2"), pieces);
function persist() {
  try {
    localStorage.setItem("aha:saved:v2", JSON.stringify(saved));
    localStorage.setItem("aha:bag:v2", JSON.stringify(bag));
  } catch {
    storage = false;
  }
  render();
}
function render() {
  document
    .querySelectorAll<HTMLElement>("[data-saved-count]")
    .forEach((el) => (el.textContent = String(saved.length)));
  document
    .querySelectorAll<HTMLElement>("[data-bag-count]")
    .forEach(
      (el) =>
        (el.textContent = String(bag.reduce((n, v) => n + v.quantity, 0))),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-save]")
    .forEach((button) => {
      const selected = saved.includes(button.dataset.save!);
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = button.classList.contains("save-button")
        ? selected
          ? "♥"
          : "♡"
        : selected
          ? "Saved to your list"
          : "Save this piece";
    });
  document
    .querySelectorAll<HTMLElement>("[data-saved-piece]")
    .forEach(
      (card) => (card.hidden = !saved.includes(card.dataset.savedPiece!)),
    );
  const empty = document.querySelector<HTMLElement>("[data-saved-empty]");
  if (empty) empty.hidden = saved.length > 0;
  document
    .querySelectorAll<HTMLElement>("[data-storage-feedback]")
    .forEach(
      (el) =>
        (el.textContent = storage
          ? "Saved on this device. No account needed."
          : "Device storage is unavailable. Your changes last for this visit only."),
    );
  const rows = document.getElementById("bag-rows");
  if (rows) {
    rows.replaceChildren();
    for (const line of bag) {
      const product = pieces.find((p) =>
        p.variants.some((v) => v.id === line.id),
      )!;
      const variant = product.variants.find((v) => v.id === line.id)!;
      const row = document.createElement("article");
      row.className = "bag-row";
      const link = document.createElement("a");
      link.href = "/pieces/" + product.slug + "/";
      link.textContent =
        product.title + " / " + variant.color + " / " + variant.size;
      const qty = document.createElement("select");
      qty.setAttribute("aria-label", "Quantity for " + product.title);
      for (let i = 1; i <= Math.min(10, variant.available); i++) {
        const opt = new Option(String(i), String(i));
        qty.add(opt);
      }
      qty.value = String(line.quantity);
      qty.addEventListener("change", () => {
        line.quantity = Number(qty.value);
        persist();
      });
      const price = document.createElement("span");
      price.textContent = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format((variant.price * line.quantity) / 100);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-link";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + product.title);
      remove.addEventListener("click", () => {
        bag = bag.filter((v) => v.id !== line.id);
        persist();
      });
      row.append(link, qty, price, remove);
      rows.append(row);
    }
    const emptyBag = document.getElementById("bag-empty");
    if (emptyBag) emptyBag.hidden = bag.length > 0;
    const summary = document.getElementById("bag-summary");
    if (summary) summary.hidden = !bag.length;
    const total = bag.reduce(
      (sum, row) =>
        sum +
        (pieces.flatMap((p) => p.variants).find((v) => v.id === row.id)
          ?.price || 0) *
          row.quantity,
      0,
    );
    const subtotal = document.getElementById("bag-subtotal");
    if (subtotal)
      subtotal.textContent = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(total / 100);
  }
}
document.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((button) =>
  button.addEventListener("click", () => {
    const slug = button.dataset.save!;
    if (!slugs.includes(slug)) return;
    saved = saved.includes(slug)
      ? saved.filter((x) => x !== slug)
      : [...saved, slug];
    persist();
  }),
);
document
  .querySelector<HTMLFormElement>("[data-add-to-bag]")
  ?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const id = String(new FormData(form).get("variant") || "");
    bag = cleanBag([...bag, { id, quantity: 1 }], pieces);
    persist();
    const status = form.querySelector<HTMLElement>("[data-bag-feedback]");
    if (status)
      status.textContent = bag.some((v) => v.id === id)
        ? "Added to your bag."
        : "Choose an available size.";
    document.dispatchEvent(
      new CustomEvent("aha:conversion", { detail: "add_to_bag" }),
    );
  });
window.addEventListener("storage", () => {
  saved = cleanSaved(read("aha:saved:v2"), slugs);
  bag = cleanBag(read("aha:bag:v2"), pieces);
  render();
});
render();
