import { loadProducts } from "@/lib/data/products";
import { isSellableProvider } from "@/lib/commerce/catalog-policy";
import { checkVariantPurchasable } from "@/lib/data/purchasable";
import type { Collection, Product } from "@/lib/utils/types";

const previewCollections: Collection[] = [
  { id: "t-shirts", slug: "t-shirts", name: "Tees", description: "Graphic tees and statement prints on premium ringspun cotton.", accent: "mint" },
  { id: "hoodies-sweatshirts", slug: "hoodies-sweatshirts", name: "Hoods & Crews", description: "Heavyweight pullover hoods and crewnecks.", accent: "blue" },
  { id: "sweaters-knitwear", slug: "sweaters-knitwear", name: "Sweaters & Knitwear", description: "Knit sweaters and premium crewnecks from the current catalog.", accent: "sunrise" },
  { id: "accessories", slug: "accessories", name: "Accessories", description: "Hats, bags, stickers, pins, and finishing pieces from the current catalog.", accent: "cream" },
];

export function buildPreviewCollections(): Collection[] {
  // Only surface a category that actually has something sellable in it. With the
  // capsule live, "Sweaters & Knitwear" and "Accessories" are both empty, and an
  // empty category page on a live store reads as a broken shop.
  const stocked = new Set(
    buildPreviewProducts()
      .filter((product) => product.variations.length > 0)
      .flatMap((product) => product.collectionIds ?? []),
  );
  return previewCollections.filter((c) => stocked.has(c.slug)).map((c) => ({ ...c }));
}

/** Validated, versioned catalog projection for credential-free non-production previews. */
export function buildPreviewProducts(): Product[] {
  return loadProducts()
    .filter((product) => product.status === "active")
    .map((product) => {
      const seenSizes = new Set<string>();
      const variations = product.variants
        // Provider gate FIRST, exactly as in buildEligibleSquareIndex. Without
        // it this path returned 117 products including retired stickers and
        // withdrawn SKUs: the legacy Printful variants still satisfy their own
        // branch of checkVariantPurchasable, so purchasability alone does not
        // keep them out. Deploy previews render from here, so a leak here is a
        // leak a reviewer sees and believes.
        .filter((variant) => isSellableProvider(variant.fulfillmentProvider))
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
