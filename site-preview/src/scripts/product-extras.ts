// Product pages only: the full-screen photo viewer and count, the quick-add bar
// on phones, and the card shown after Add to bag. Loaded by cart.ts on demand.
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
type BagAdded = { title: string; size: string; image: string; added: number; lineCents: number; items: number; subtotalCents: number };
function showBagPanel({ title, size, image, added, lineCents, items, subtotalCents }: BagAdded) {
  if (!bagPanel) {
    bagPanel = document.createElement("section");
    bagPanel.className = "bag-panel";
    bagPanel.tabIndex = -1;
    bagPanel.setAttribute("aria-labelledby", "bag-panel-title");
    bagPanel.innerHTML = `<div class="bag-panel-head"><p class="label" id="bag-panel-title">Added to your bag</p><button type="button" class="bag-panel-close" aria-label="Close" data-close>×</button></div><div class="bag-panel-item"><img alt="" width="72" height="90"><p><strong></strong><span></span><span></span></p></div><p class="bag-panel-total"><span></span><strong></strong></p><a class="button bag-panel-checkout" href="/checkout/">Checkout <span aria-hidden="true">→</span></a><button type="button" class="text-button" data-close>Keep shopping</button>`;
    document.body.append(bagPanel);
    bagPanel.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeBagPanel));
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeBagPanel(); });
    document.addEventListener("pointerdown", (event) => {
      const target = event.target as Element;
      if (bagPanel && !bagPanel.contains(target) && !target.closest?.("[data-cart-form], .buy-bar")) closeBagPanel();
    });
  }
  bagPanel.querySelector("img")!.src = image;
  const [name, detail, price] = bagPanel.querySelectorAll<HTMLElement>(".bag-panel-item strong, .bag-panel-item span");
  name!.textContent = title;
  detail!.textContent = `Size ${size} · Qty ${added}`;
  price!.textContent = MONEY.format(lineCents / 100);
  bagPanel.querySelector(".bag-panel-total span")!.textContent = `Bag subtotal · ${items} ${items === 1 ? "item" : "items"}`;
  bagPanel.querySelector(".bag-panel-total strong")!.textContent = MONEY.format(subtotalCents / 100);
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  bagPanel.hidden = false;
  bagPanel.focus({ preventScroll: true });
}

// Product photos: a "1 / 4" count on the phone carousel, and tap or click for a full-screen view.
function initGallery() {
  const gallery = document.querySelector<HTMLElement>(".product-gallery");
  const figures = gallery ? [...gallery.querySelectorAll<HTMLElement>("figure")] : [];
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
  // The viewer is built on first use, so pages carry no empty image.
  let viewer: HTMLDialogElement | null = null;
  const openViewer = () => {
    if (viewer) return viewer;
    const dialog = document.createElement("dialog");
    dialog.className = "photo-viewer";
    dialog.innerHTML = `<button type="button" class="photo-viewer-close" aria-label="Close">×</button><div class="photo-viewer-frame"><img alt=""></div>`;
    document.body.append(dialog);
    dialog.querySelector("button")!.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog || event.target === dialog.querySelector(".photo-viewer-frame")) dialog.close(); });
    return (viewer = dialog);
  };
  figures.forEach((figure) => {
    const image = figure.querySelector("img");
    if (!image) return;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "photo-zoom";
    open.setAttribute("aria-label", `Enlarge photo: ${figure.querySelector("figcaption")?.textContent ?? "view"}`);
    open.addEventListener("click", () => {
      const dialog = openViewer();
      const large = dialog.querySelector("img")!;
      large.alt = image.alt;
      large.sizes = "200vw";
      large.srcset = image.srcset;
      large.src = image.currentSrc || image.src;
      dialog.setAttribute("aria-label", image.alt);
      dialog.showModal();
      const frame = large.parentElement!;
      requestAnimationFrame(() => { frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2; });
    });
    figure.append(open);
  });
}

// Phones: the photos fill the first screen, so a bar along the bottom keeps the
// price and the next step in reach until the size picker scrolls into view.
function initBuyBar() {
  const form = document.querySelector<HTMLFormElement>("[data-cart-form]");
  const title = document.querySelector(".product-details h1")?.textContent?.trim();
  const price = document.querySelector(".product-details .product-price")?.firstChild?.textContent?.trim();
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
  const selected = () => form.querySelector<HTMLInputElement>("[data-cart-variant]:checked");
  const refresh = () => { const size = selected()?.dataset.size; action.textContent = added ? "View bag →" : size ? `Add ${size} to bag` : "Choose a size"; };
  action.addEventListener("click", () => {
    if (added) { location.href = "/checkout/"; return; }
    if (selected()) { form.requestSubmit(); return; }
    form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    form.querySelector<HTMLInputElement>("[data-cart-variant]")?.focus({ preventScroll: true });
  });
  form.addEventListener("change", () => { added = false; refresh(); });
  document.addEventListener("aha:cart-added", () => { added = true; refresh(); });
  refresh();
  bar.hidden = true;
  document.body.append(bar);
  document.body.classList.add("has-buy-bar");
  new IntersectionObserver(([entry]) => { bar.hidden = Boolean(entry?.isIntersecting); }).observe(form);
}

/** As soon as the module loads: the photo viewer and the bag card. */
export function initProductExtras() {
  initGallery();
  document.addEventListener("aha:bag-added", (event) => showBagPanel((event as CustomEvent<BagAdded>).detail));
}
export { initBuyBar };
