import type { Product } from "@/lib/utils/types";

export const PILOT_ASSORTMENT = [
  {
    slug: "branded-unisex-hoodie",
    image: "/printful-assets/Branded_Unisex_Hoodie.png",
    edition: "Pink wordmark",
  },
  {
    slug: "classic-black-unisex-hoodie",
    image: "/printful-assets/Classic_-_Black_Unisex_Hoodie.png",
    edition: "White wordmark",
  },
  {
    slug: "colors-unisex-hoodie",
    image: "/printful-assets/Colors_Unisex_Hoodie.png",
    edition: "Spectrum wordmark",
  },
] as const;

interface PilotAssortmentEntry {
  slug: string;
  image: string;
  edition: string;
  index: number;
}

const pilotBySlug: ReadonlyMap<string, PilotAssortmentEntry> = new Map(
  PILOT_ASSORTMENT.map((item, index) => [item.slug, { ...item, index }]),
);

export function getPilotEdition(slug: string): string | undefined {
  return pilotBySlug.get(slug)?.edition;
}

export function applyPilotAssortment(products: Product[]): Product[] {
  return products
    .filter((product) => pilotBySlug.has(product.slug))
    .map((product) => ({
      ...product,
      images: [pilotBySlug.get(product.slug)!.image],
    }))
    .sort((left, right) => pilotBySlug.get(left.slug)!.index - pilotBySlug.get(right.slug)!.index);
}
