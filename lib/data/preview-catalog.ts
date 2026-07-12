import { loadProducts } from "@/lib/data/products";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import type { Collection, Product } from "@/lib/utils/types";

const previewCollections: Collection[] = [
  { id: "tees", slug: "tees", name: "Tees", description: "Graphic tees from the current catalog.", accent: "mint" },
  { id: "hoodies", slug: "hoodies", name: "Hoodies", description: "Layer-ready hoodies from the current catalog.", accent: "blue" },
  { id: "sweaters", slug: "sweaters", name: "Sweaters", description: "Sweaters and sweatshirts from the current catalog.", accent: "sunrise" },
  { id: "accessorys", slug: "accessories", name: "Accessories", description: "Finishing pieces from the current catalog.", accent: "cream" },
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
        collectionIds: product.collectionIds,
        collectionNames: product.collectionIds
          .map((id) => previewCollections.find((collection) => collection.id === id)?.name)
          .filter((name): name is string => Boolean(name)),
        variations,
      };
    })
    .filter((product) => product.variations.length > 0);
}
