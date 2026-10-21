// Garment details shared by the Astro pages and the live-page renderer
// (server/catalog/render.mjs), so built and live product pages can't drift.

export const COLOR_SWATCHES = { Bone: "#eae6db", Maroon: "#5a1e2a", Black: "#171717", Grey: "#989795", "Heather Gray": "#b7b7b5", "Heather Grey": "#b7b7b5", "Grey Heather": "#adadaa", Navy: "#19253C", "Dark Green": "#193F33", "Forest Camo": "#566047", "Snow Camo": "#d7d9d5", Ivory: "#eee8d6", Butter: "#f0df9b", Mustard: "#bc912f", "Light Pink": "#edc8d0", Blossom: "#deb2bc", Midnight: "#344954", "True Navy": "#1e2c43", "True Royal": "#2755a0", "Forest Green": "#244d3f", Pink: "#e7acbc", White: "#f7f5ef", "Dark Heather Grey": "#626466", "Blaze Orange": "#ff5100", Camel: "#a87c48", Cardinal: "#991313", Fuchsia: "#b72657", Gold: "#fec500", "Kelly Green": "#45966b", Red: "#d60024", "Royal Blue": "#0647be" };

export const swatchFor = (color) => COLOR_SWATCHES[color] ?? "#eae6db";

/** Shop filter groups, in the order the filter shows them. */
export const GARMENT_GROUPS = [
  { key: "cropped-hoodies", label: "Cropped hoodies" },
  { key: "tees", label: "T-shirts" },
  { key: "long-sleeves", label: "Long sleeves" },
  { key: "crewnecks", label: "Crewnecks" },
  { key: "hoodies", label: "Hoodies" },
  { key: "beanies", label: "Beanies" },
];

export function garmentGroup(typeLabel) {
  const type = String(typeLabel ?? "").toLowerCase();
  if (type.includes("cropped") && type.includes("hoodie")) return "cropped-hoodies";
  if (type.includes("hoodie")) return "hoodies";
  if (type.includes("long sleeve")) return "long-sleeves";
  if (type.includes("crewneck")) return "crewnecks";
  if (type.includes("tee") || type.includes("t-shirt")) return "tees";
  if (type.includes("beanie")) return "beanies";
  return "other";
}

/** Merchandise by cut, preserving the existing order within each garment style. */
export function garmentsInOrder(products) {
  const rank = (product) => {
    const index = GARMENT_GROUPS.findIndex(group => group.key === garmentGroup(product.typeLabel));
    return index < 0 ? GARMENT_GROUPS.length : index;
  };
  return [...products].sort((a, b) => rank(a) - rank(b));
}

/** The same garment in its other colors. */
export const otherColors = (product, products) => products.filter((entry) => entry.slug !== product.slug && entry.collection === product.collection && entry.typeLabel === product.typeLabel);

/** The view a product card shows on hover: the first one that differs from its main photo. */
export const hoverView = (product) => product.gallery.find((shot, index) => index > 0 && (shot.role === "front" || shot.role === "back")) ?? product.gallery[1] ?? null;

/** The how-to-measure drawing on every product page (Astro and the live renderer share it). */
export const MEASURE_DIAGRAM = '<figure class="measure-figure"><svg class="measure-diagram" viewBox="0 0 260 230" role="img" aria-labelledby="measure-title measure-desc" xmlns="http://www.w3.org/2000/svg"><title id="measure-title">How to measure a top</title><desc id="measure-desc">Lay the top flat. Chest width runs straight across, one inch below the armholes. Body length runs from the highest point of the shoulder, next to the collar, down to the hem.</desc><path class="measure-garment" d="M92 22 Q130 40 168 22 L218 46 L246 112 L212 124 L198 92 L198 212 L62 212 L62 92 L48 124 L14 112 L42 46 Z"/><path class="measure-garment" d="M92 22 Q130 54 168 22"/><path class="measure-line" d="M64 104 H196 M64 98 V110 M196 98 V110"/><text class="measure-text" x="118" y="94" text-anchor="middle">Chest width</text><path class="measure-line" d="M172 26 V208 M166 26 H178 M166 208 H178"/><text class="measure-text" x="164" y="160" text-anchor="end">Body length</text></svg><figcaption>Lay a top flat. Measure straight across the chest, an inch below the armholes, and from the top of the shoulder to the hem.</figcaption></figure>';


/** Shared body measurements, or actual knit height for headwear. */
export function measurementGuide(product) {
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  const measure = (value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const beanie = product.typeLabel === "Beanie";
  const sleeves = !beanie && product.sizeGuide.every((row) => typeof row.sleeveLength === "number");
  return `<section class="shell section size-guide" id="size-guide" aria-labelledby="size-title"><p class="label">Finished garment measurements · inches</p><h2 id="size-title">Find your fit.</h2><p>${esc(product.measurementGuidance)}</p>${product.sleeveMeasurementGuidance ? `<p>${esc(product.sleeveMeasurementGuidance)}</p>` : ""}${beanie ? "" : MEASURE_DIAGRAM}<div class="size-table-wrap" role="region" aria-label="${esc(product.title)} measurements" tabindex="0"><table><thead><tr><th scope="col">Size</th>${beanie ? `<th scope="col">Unfolded height</th>` : `<th scope="col">Chest width</th><th scope="col">Body length</th>${sleeves ? `<th scope="col">Sleeve length</th>` : ""}`}</tr></thead><tbody>${product.sizeGuide.map((row) => `<tr><th scope="row">${esc(row.size)}</th>${beanie ? `<td>${measure(row.height)}</td>` : `<td>${measure(row.chestWidth)}</td><td>${measure(row.bodyLength)}</td>${sleeves ? `<td>${measure(row.sleeveLength)}</td>` : ""}`}</tr>`).join("")}</tbody></table></div></section>`;
}
