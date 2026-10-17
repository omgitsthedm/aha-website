// Garment details shared by the Astro pages and the live-page renderer
// (server/catalog/render.mjs), so built and live product pages can't drift.

export const COLOR_SWATCHES = { Bone: "#eae6db", Maroon: "#5a1e2a", Black: "#171717", Grey: "#989795", "Heather Gray": "#b7b7b5", "Heather Grey": "#b7b7b5", "Grey Heather": "#adadaa", Navy: "#19253C", "Dark Green": "#193F33" };

export const swatchFor = (color) => COLOR_SWATCHES[color] ?? "#eae6db";

/** Shop filter groups, in the order the filter shows them. */
export const GARMENT_GROUPS = [
  { key: "hoodies", label: "Hoodies" },
  { key: "crewnecks", label: "Crewnecks" },
  { key: "long-sleeves", label: "Long sleeves" },
];

export function garmentGroup(typeLabel) {
  const type = String(typeLabel ?? "").toLowerCase();
  if (type.includes("hoodie")) return "hoodies";
  if (type.includes("long sleeve")) return "long-sleeves";
  if (type.includes("crewneck")) return "crewnecks";
  return "other";
}

/** The same garment in its other colors. */
export const otherColors = (product, products) => products.filter((entry) => entry.slug !== product.slug && entry.collection === product.collection && entry.typeLabel === product.typeLabel);

/** The view a product card shows on hover: the first one that differs from its main photo. */
export const hoverView = (product) => product.gallery.find((shot, index) => index > 0 && (shot.role === "front" || shot.role === "back")) ?? product.gallery[1] ?? null;

/** The how-to-measure drawing on every product page (Astro and the live renderer share it). */
export const MEASURE_DIAGRAM = '<figure class="measure-figure"><svg class="measure-diagram" viewBox="0 0 260 230" role="img" aria-labelledby="measure-title measure-desc" xmlns="http://www.w3.org/2000/svg"><title id="measure-title">How to measure a top</title><desc id="measure-desc">Lay the top flat. Chest width runs straight across, one inch below the armholes. Body length runs from the highest point of the shoulder, next to the collar, down to the hem.</desc><path class="measure-garment" d="M92 22 Q130 40 168 22 L218 46 L246 112 L212 124 L198 92 L198 212 L62 212 L62 92 L48 124 L14 112 L42 46 Z"/><path class="measure-garment" d="M92 22 Q130 54 168 22"/><path class="measure-line" d="M64 104 H196 M64 98 V110 M196 98 V110"/><text class="measure-text" x="118" y="94" text-anchor="middle">Chest width</text><path class="measure-line" d="M172 26 V208 M166 26 H178 M166 208 H178"/><text class="measure-text" x="164" y="160" text-anchor="end">Body length</text></svg><figcaption>Lay a top flat. Measure straight across the chest, an inch below the armholes, and from the top of the shoulder to the hem.</figcaption></figure>';
