import type { Product, Collection } from "@/lib/utils/types";
import type { ProductEnrichment } from "@/lib/data/enrichment";

const TYPE_NAMES: Record<string, string> = {
  accessory: "accessory",
  hat: "headwear piece",
  hoodie: "hoodie",
  jacket: "jacket",
  sticker: "sticker",
  sweater: "sweatshirt",
  tee: "graphic tee",
};

const clean = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function buildProductStory(
  product: Product,
  enrichment?: ProductEnrichment | null,
  collection?: Collection,
): string {
  const type = TYPE_NAMES[enrichment?.productType || ""] || "piece";
  const collectionLine = collection?.description
    ? ` ${clean(collection.description)}`
    : " Built for life outside the expected schedule.";
  const fabric = enrichment?.fabricDescription
    ? ` The garment uses ${clean(enrichment.fabricDescription).replace(/\.$/, "").toLowerCase()}.`
    : "";

  return `${product.name} puts the graphic front and center on a made-to-order ${type}.${collectionLine}${fabric} Review the live sizes, care, free shipping, and 30-day return terms before adding it to your bag.`;
}
