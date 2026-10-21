import { query, queryAll } from "./dom";
// Product pages only: the full-screen photo viewer and count, the quick-add bar
// on phones, the card shown after Add to bag, delivery estimates and the fit
// profile. Loaded by cart.ts on demand.
import { deliveryLines } from "./delivery";
import { recommendSize, type Fit, type SizeRow } from "./fit";
import { readSaved, writeSaved } from "./saved";

// Product photos: a "1 / 4" count on the phone carousel, and tap or click for a full-screen view.
function initGallery() {
  const gallery = query<HTMLElement>(document, ".product-gallery");
  const figures = gallery ? [...queryAll<HTMLElement>(gallery, "figure")] : [];
  if (!gallery || figures.length < 2) return;
  const counter = document.createElement("p");
  counter.className = "gallery-count";
  counter.setAttribute("aria-hidden", "true");
  gallery.after(counter);
  const update = () => {
    const step = Math.max(1, figures[1]!.offsetLeft - figures[0]!.offsetLeft);
    counter.textContent = `${Math.min(figures.length, Math.round(gallery.scrollLeft / step) + 1)} / ${figures.length}`;
  };
  gallery.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  update();
  let viewer: Promise<ReturnType<typeof import("./product-viewer").createPhotoViewer>> | undefined;
  figures.forEach((figure, index) => {
    const image = query(figure, "img");
    if (!image) return;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "photo-zoom";
    open.setAttribute("aria-label", `Enlarge photo: ${query(figure, "figcaption")?.textContent ?? "view"}`);
    open.addEventListener("click", async () => {
      open.disabled = true;
      try {
        viewer ??= import("./product-viewer").then(({ createPhotoViewer }) => createPhotoViewer(figures));
        const view = await viewer;
        view.show(index);
        view.dialog.showModal();
      } catch {
        viewer = undefined;
        open.setAttribute("aria-label", "Photo did not open. Try enlarging again.");
      } finally { open.disabled = false; }
    });
    figure.append(open);
  });
}

// Phones: the photos fill the first screen, so a bar along the bottom keeps the
// price and the next step in reach until the size picker scrolls into view.
function initBuyBar() {
  const form = query<HTMLFormElement>(document, "[data-cart-form]");
  const title = query(document, ".product-details h1")?.textContent?.trim();
  const price = query(document, ".product-details .product-price")?.firstChild?.textContent?.trim();
  if (!form || !title || !price || !("IntersectionObserver" in window)) return;
  const bar = document.createElement("div");
  bar.className = "buy-bar";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Quick add");
  const name = document.createElement("strong");
  name.textContent = title;
  const cost = document.createElement("span");
  cost.textContent = price;
  const text = document.createElement("p");
  text.append(name, cost);
  const action = document.createElement("button");
  action.type = "button";
  action.className = "button";
  bar.append(text, action);
  let added = false;
  const selected = () => query<HTMLInputElement>(form, "[data-cart-variant]:checked");
  const refresh = () => { const size = selected()?.dataset.size; action.textContent = added ? "View bag " : size ? `Add ${size} to bag` : "Choose a size"; };
  action.addEventListener("click", () => {
    if (added) { location.href = "/checkout/"; return; }
    if (selected()) { form.requestSubmit(); return; }
    form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    query<HTMLInputElement>(form, "[data-cart-variant]")?.focus({ preventScroll: true });
  });
  form.addEventListener("change", () => { added = false; refresh(); });
  document.addEventListener("aha:cart-added", () => { added = true; refresh(); });
  refresh();
  bar.hidden = true;
  document.body.append(bar);
  document.body.classList.add("has-buy-bar");
  new IntersectionObserver(([entry]) => { bar.hidden = Boolean(entry?.isIntersecting); }).observe(form);
}

// Delivery estimate under the price; the page reserves its space so nothing moves.
function initArrival() {
  const target = query<HTMLElement>(document, "[data-arrival]");
  if (!target) return;
  target.replaceChildren(...deliveryLines().map((line, index) => Object.assign(document.createElement("p"), { textContent: line, className: index ? "arrival-holiday" : "" })));
}

// Fit profile: two measurements of a top the visitor already likes, kept only in
// this browser, matched against the finished-garment measurements on the page.
const FIT_KEY = "aha-fit-v1";
let currentFit: Fit | null | undefined;

function readFit(): Fit | null {
  if (currentFit !== undefined) return currentFit;
  try { const value = JSON.parse(localStorage.getItem(FIT_KEY) || "null"); return (currentFit = value && Number.isFinite(value.chest) && Number.isFinite(value.length) ? value : null); } catch { return null; }
}
function sizeRows(): SizeRow[] {
  return [...queryAll<HTMLTableRowElement>(document, ".size-table-wrap tbody tr")].map((row) => ({ size: query(row, "th")?.textContent?.trim() ?? "", chest: Number.parseFloat(row.cells[1]?.textContent ?? ""), length: Number.parseFloat(row.cells[2]?.textContent ?? "") })).filter((row) => row.size && Number.isFinite(row.chest) && Number.isFinite(row.length));
}
function initFit() {
  const open = query<HTMLButtonElement>(document, "[data-fit-open]");
  const form = query<HTMLFormElement>(document, "[data-cart-form]");
  const rows = sizeRows();
  if (!open || !form || !rows.length) return;
  let dialog: Promise<ReturnType<typeof import("./product-fit").createFitDialog>> | undefined;
  const refresh = () => {
    const fit = readFit();
    const pick = fit ? recommendSize(rows, fit) : null;
    open.textContent = pick ? `Closest width: ${pick.size}` : fit ? "Compare measurements" : "Find my size";
    queryAll<HTMLLabelElement>(form, ".size-options label").forEach((label) => label.classList.toggle("is-recommended", Boolean(pick) && query<HTMLInputElement>(label, "input")?.dataset.size === pick!.size));
    return { fit, pick };
  };
  open.hidden = false;
  refresh();
  open.addEventListener("click", async () => {
    open.disabled = true;
    try {
      dialog ??= import("./product-fit").then(({ createFitDialog }) => createFitDialog(form, refresh, (fit) => {
        currentFit = fit;
        try { if (fit) localStorage.setItem(FIT_KEY, JSON.stringify(fit)); else localStorage.removeItem(FIT_KEY); } catch { /* The current-page comparison remains usable without storage. */ }
      }));
      const view = await dialog;
      view.refreshView();
      view.showModal();
      document.dispatchEvent(new CustomEvent("aha:fit", { detail: { action: "open", matched: Boolean(refresh().pick) } }));
    } catch {
      dialog = undefined;
      open.textContent = "Try size comparison again";
      query<HTMLElement>(document, "#size-guide")?.scrollIntoView({ block: "start" });
    } finally { open.disabled = false; }
  });
}

// Save for later: kept in this browser, and in the account when signed in.
function initSave() {
  const button = query<HTMLButtonElement>(document, "[data-save]");
  if (!button) return;
  const slug = button.dataset.save!;
  const show = () => button.setAttribute("aria-pressed", String(readSaved().includes(slug)));
  button.hidden = false;
  show();
  button.addEventListener("click", () => {
    const saving = button.getAttribute("aria-pressed") !== "true";
    writeSaved(saving ? [slug, ...readSaved().filter((entry) => entry !== slug)] : readSaved().filter((entry) => entry !== slug));
    show();
    const status = query(document, "[data-cart-add-status]");
    if (status) status.innerHTML = saving ? 'Saved. <a href="/account/#saved">See your saved pieces</a>' : "Removed from your saved pieces.";
  });
}

// Approved reviews, if there are any. None are shown otherwise.
type Review = { rating: number; body: string; name: string | null; date: string };
async function initReviews() {
  const section = query<HTMLElement>(document, "[data-reviews]");
  if (!section) return;
  try {
    const response = await fetch(`/api/reviews?product=${encodeURIComponent(section.dataset.reviews!)}`, { headers: { accept: "application/json" } });
    const data = response.ok ? await response.json() as { count: number; average: number | null; reviews: Review[] } : null;
    if (!data?.count) return;
    query(section, "[data-review-summary]")!.textContent = `${data.average} out of 5 · ${data.count} ${data.count === 1 ? "review" : "reviews"}`;
    query(section, "[data-review-list]")!.replaceChildren(...data.reviews.map((review) => {
      const item = document.createElement("li");
      const stars = Object.assign(document.createElement("p"), { className: "review-stars", textContent: "★".repeat(review.rating) + "☆".repeat(5 - review.rating) });
      stars.setAttribute("aria-label", `${review.rating} out of 5`);
      item.append(stars, Object.assign(document.createElement("p"), { textContent: review.body }), Object.assign(document.createElement("p"), { className: "review-by", textContent: `${review.name ?? "Verified buyer"} · ${new Date(`${review.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` }));
      return item;
    }));
    section.hidden = false;
  } catch { /* Reviews are optional. */ }
}

// A drop not yet released: buying waits for early access (signed in) or the release.
async function initDrop() {
  const note = query<HTMLElement>(document, "[data-drop]");
  if (!note) return;
  const now = Date.now();
  if (now >= Date.parse(note.dataset.release!)) { note.hidden = true; return; }
  const early = now >= Date.parse(note.dataset.early!);
  const signedIn = early && await fetch("/api/account/me").then((response) => response.ok ? response.json() : {}).then((data) => Boolean((data as { signedIn?: boolean }).signedIn)).catch(() => false);
  if (signedIn) { note.textContent = "Early access is open for your account."; return; }
  queryAll<HTMLButtonElement>(document, ".add-to-bag, .buy-now").forEach((button) => { button.disabled = true; });
  note.append(" ", Object.assign(document.createElement("a"), { href: "/account/", className: "text-link", textContent: early ? "Sign in for early access" : "Create an account for early access" }));
}

/** As soon as the module loads: the photo viewer, the bag card, delivery dates, the fit profile, Save, reviews and early access. */
export function initProductExtras() {
  initGallery();
  initArrival();
  initFit();
  initSave();
  void initReviews();
  void initDrop();
  document.addEventListener("aha:bag-added", (event) => {
    const detail = (event as CustomEvent<import("./product-bag").BagAdded>).detail;
    void import("./product-bag").then(({ showBagPanel }) => showBagPanel(detail)).catch(() => { /* Inline add confirmation and the header bag remain available. */ });
  });
}
export { initBuyBar };
