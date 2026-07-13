import type { Product } from "@/lib/utils/types";

export type GenderSlug = "men" | "women" | "unisex";
export type CategorySlug =
  | "t-shirts"
  | "hoodies-sweatshirts"
  | "sweaters-knitwear"
  | "outerwear"
  | "accessories";

export interface CategoryMeta {
  slug: CategorySlug;
  name: string;
  shortName: string;
  description: string;
  image?: string;
}

export interface GenderMeta {
  slug: GenderSlug;
  name: string;
  description: string;
  image?: string;
}

export const GENDERS: GenderMeta[] = [
  {
    slug: "men",
    name: "Men",
    description: "Streetwear built for the second shift.",
  },
  {
    slug: "women",
    name: "Women",
    description: "Streetwear built for the second shift.",
  },
  {
    slug: "unisex",
    name: "Unisex",
    description: "Made for every body. Core pieces sized to share.",
  },
];

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "t-shirts",
    name: "T-Shirts",
    shortName: "Tees",
    description: "Graphic tees, staple shirts, and statement prints.",
  },
  {
    slug: "hoodies-sweatshirts",
    name: "Hoodies & Sweatshirts",
    shortName: "Hoodies",
    description: "Layer-ready hoodies and heavyweight sweatshirts.",
  },
  {
    slug: "sweaters-knitwear",
    name: "Sweaters & Knitwear",
    shortName: "Knitwear",
    description: "Premium crewnecks, cardigans, and knitted pieces.",
  },
  {
    slug: "outerwear",
    name: "Outerwear",
    shortName: "Outerwear",
    description: "Jackets and coats. Coming soon.",
  },
  {
    slug: "accessories",
    name: "Accessories",
    shortName: "Accessories",
    description: "Hats, bags, stickers, pins, and finishing pieces.",
  },
];

export function getCategoryBySlug(slug: string): CategoryMeta | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getGenderBySlug(slug: string): GenderMeta | undefined {
  return GENDERS.find((g) => g.slug === slug);
}

export function getCategorySlugsForGender(gender: GenderSlug): CategorySlug[] {
  if (gender === "unisex") {
    return ["t-shirts", "hoodies-sweatshirts", "sweaters-knitwear", "accessories"];
  }
  return ["t-shirts", "hoodies-sweatshirts", "sweaters-knitwear", "accessories"];
}

export function productMatchesGender(product: Product, gender: GenderSlug): boolean {
  const genders = product.gender || [];
  return genders.includes(gender);
}

export function productMatchesCategory(product: Product, category: CategorySlug): boolean {
  return product.category === category;
}

export function filterProductsByGender(
  products: Product[],
  gender: GenderSlug
): Product[] {
  return products.filter((p) => productMatchesGender(p, gender));
}

export function filterProductsByCategory(
  products: Product[],
  category: CategorySlug
): Product[] {
  return products.filter((p) => productMatchesCategory(p, category));
}
