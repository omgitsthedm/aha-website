import { query } from "./dom";

/** Loaded only when a shopper asks to enlarge a garment photograph. */
export function createPhotoViewer(figures: HTMLElement[]) {
  let activeView = 0;
  const dialog = document.createElement("dialog");
  dialog.className = "photo-viewer";
  dialog.append(query<HTMLTemplateElement>(document, "#photo-content")!.content.cloneNode(true));
  document.body.append(dialog);
  const frame = query<HTMLElement>(dialog, ".photo-viewer-frame")!;
  const large = query<HTMLImageElement>(dialog, "img")!;
  const controls = document.createElement("div");
  controls.className = "photo-viewer-controls";
  const previous = Object.assign(document.createElement("button"), { type: "button", textContent: "Previous view" });
  const next = Object.assign(document.createElement("button"), { type: "button", textContent: "Next view" });
  const thumbnails = document.createElement("div");
  thumbnails.className = "photo-viewer-thumbnails";
  thumbnails.setAttribute("aria-label", "Choose a garment view");
  const choices = figures.map((figure, index) => {
    const image = query<HTMLImageElement>(figure, "img")!;
    const label = query(figure, "figcaption")?.textContent?.trim() || `View ${index + 1}`;
    const choice = Object.assign(document.createElement("button"), { type: "button" });
    choice.setAttribute("aria-label", `Show ${label} view`);
    const thumbnail = document.createElement("img");
    thumbnail.src = image.currentSrc || image.src;
    thumbnail.alt = "";
    choice.append(thumbnail);
    choice.addEventListener("click", () => show(index));
    thumbnails.append(choice);
    return choice;
  });
  const show = (index: number) => {
    activeView = Math.max(0, Math.min(figures.length - 1, index));
    const figure = figures[activeView]!;
    const image = query<HTMLImageElement>(figure, "img")!;
    const label = query(figure, "figcaption")?.textContent?.trim() || `View ${activeView + 1}`;
    large.alt = image.alt;
    large.sizes = "200vw";
    large.srcset = image.srcset;
    large.src = image.currentSrc || image.src;
    dialog.setAttribute("aria-label", `${label} view: ${image.alt}`);
    choices.forEach((choice, choiceIndex) => choice.setAttribute("aria-current", String(choiceIndex === activeView)));
    previous.disabled = activeView === 0;
    next.disabled = activeView === figures.length - 1;
    requestAnimationFrame(() => { frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2; });
  };
  previous.addEventListener("click", () => show(activeView - 1));
  next.addEventListener("click", () => show(activeView + 1));
  controls.append(previous, next);
  dialog.append(controls, thumbnails);
  query(dialog, ".photo-viewer-close")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  return { dialog, show };
}
