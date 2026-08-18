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

const GENDERS: GenderMeta[] = [
  {
    slug: "men",
    name: "Men",
    description: "Everyday tees, hoodies, and heavyweight staples in unisex cuts.",
  },
  {
    slug: "women",
    name: "Women",
    description: "Expressive tees, soft-tone sweatshirts, and everyday staples in unisex cuts.",
  },
  {
    slug: "unisex",
    name: "Unisex",
    description: "One cut, worn your way. The unisex core of the label.",
  },
];

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "t-shirts",
    name: "Tees",
    shortName: "Tees",
    description: "Graphic tees on soft ringspun cotton — the ones you reach for first.",
  },
  {
    slug: "hoodies-sweatshirts",
    name: "Hoods & Crews",
    shortName: "Hoods & Crews",
    description: "Heavyweight pullover hoods and crewnecks, built to be borrowed.",
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
    // Consumers concatenate this into a meta description, so "Coming soon."
    // produced the self-contradicting "Jackets and coats. Coming soon. Shop
    // made-to-order outerwear." The empty-category state already tells a
    // visitor there is nothing here yet; the description should not also
    // try to, in a sentence that then gets a shopping CTA appended to it.
    //
    // It also must not name a city next to "printed"/"made": production runs in
    // Huntington Park CA or Philadelphia PA, not New York. Every consumer of
    // this field already appends its own origin and made-to-order claim (see
    // ORIGIN_CLAIM_SENTENCE in lib/commerce/policies.ts), so the description
    // stays a plain noun phrase like every sibling category.
    description: "Jackets and coats, built to layer.",
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
