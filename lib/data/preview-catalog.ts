import { loadProducts } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import type { Collection, Product } from "@/lib/utils/types";

const previewCollections: Collection[] = [
  { id: "t-shirts", slug: "t-shirts", name: "T-Shirts", description: "Graphic tees and staple shirts from the current catalog.", accent: "mint" },
  { id: "hoodies-sweatshirts", slug: "hoodies-sweatshirts", name: "Hoodies & Sweatshirts", description: "Layer-ready hoodies and sweatshirts from the current catalog.", accent: "blue" },
  { id: "sweaters-knitwear", slug: "sweaters-knitwear", name: "Sweaters & Knitwear", description: "Knit sweaters and premium crewnecks from the current catalog.", accent: "sunrise" },
  { id: "accessories", slug: "accessories", name: "Accessories", description: "Hats, bags, stickers, pins, and finishing pieces from the current catalog.", accent: "cream" },
];

export function buildPreviewCollections(): Collection[] {
  return previewCollections.map((collection) => ({ ...collection }));
}

/** Validated, versioned catalog projection for credential-free non-production previews. */
export function buildPreviewProducts(): Product[] {
  return loadProducts()
    .filter((product) => product.status === "active")
    .map((product) => {
      const seenSizes = new Set<string>();
      const variations = product.variants
        .filter((variant) => checkVariantPurchasable(product, variant).ok)
        .filter((variant) => {
          const size = variant.size.toUpperCase();
          if (seenSizes.has(size)) return false;
          seenSizes.add(size);
          return true;
        })
        .map((variant, index) => ({
          id: variant.squareVariationId || variant.ahaVariantId,
          name: variant.size,
          sku: variant.sku,
          price: variant.retailPrice,
          priceFormatted: `$${(variant.retailPrice / 100).toFixed(2)}`,
          ordinal: index,
        }));
      const images = [product.featuredImage, ...product.galleryImages].filter(
        (image, index, all) => Boolean(image) && all.indexOf(image) === index,
      );
      const price = variations.length
        ? Math.min(...variations.map((variation) => variation.price))
        : product.retailPrice;

      return {
        id: product.ahaProductId,
        slug: product.slug,
        name: product.title,
        description: product.fullDescription,
        price,
        priceFormatted: `$${(price / 100).toFixed(2)}`,
        currency: product.currency,
        images,
        collectionIds: [product.category],
        collectionNames: [previewCollections.find((collection) => collection.id === product.category)?.name].filter(
          (name): name is string => Boolean(name),
        ),
        variations,
        category: product.category,
        gender: product.gender,
      };
    })
    .filter((product) => product.variations.length > 0);
}
