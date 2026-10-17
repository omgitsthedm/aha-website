// The order the shop, home page and lookbook show collections: newest drop first. Put a
// new collection at the front to feature it. Collections not listed follow in
// catalog order, so a product removed from sale never leads the page.
import products from "./products.json" with { type: "json" };

export type Product = (typeof products)[number];

export const COLLECTION_ORDER = ["Mighty Mick’s", "The City", "Insomniac", "Yikes!"];

export function collectionsInOrder(pieces: Product[] = products) {
  const names = [...new Set(pieces.map((product) => product.collection))];
  const ordered = [...COLLECTION_ORDER.filter((name) => names.includes(name)), ...names.filter((name) => !COLLECTION_ORDER.includes(name))];
  return ordered.map((name) => [name, pieces.filter((product) => product.collection === name)] as const);
}

export const collectionId = (name: string) => `collection-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** URL slug for a collection page: "Mighty Mick’s" → "mighty-micks". */
export const collectionSlug = (name: string) => name.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const COLLECTION_COPY: Record<string, string> = {
  "The City": "Black fleece and cotton jersey with a blue-and-orange back print and a plain front.",
  Insomniac: "Long-sleeve layers with a front chest mark and a full back sketch.",
  "Mighty Mick’s": "Midweight crewnecks in navy or dark green with a one-color front print.",
  "Yikes!": "Bone fleece in two cuts with a yellow-and-blue chest graphic.",
};
export const collectionCopy = (name: string) => COLLECTION_COPY[name] ?? "Current pieces from the Fall / Winter 2026 collection.";
