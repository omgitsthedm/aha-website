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
