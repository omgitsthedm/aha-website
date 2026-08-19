import { getAllProducts, getProduct } from "@/lib/square/catalog";
import { getProductEnrichment, type ProductEnrichment } from "@/lib/data/enrichment";
import { getStockByCatId } from "@/lib/data/stock";
import { ProductDetail, type ColorwayOption } from "@/components/product/ProductDetail";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { notFound } from "next/navigation";
import type { Product } from "@/lib/utils/types";
import type { Metadata } from "next";
import { buildProductStory, isAuthoredSquareDescription } from "@/lib/content/product-copy";
import { loadProducts } from "@/lib/data/products";
import { getProductReviews } from "@/lib/commerce/reviews";
import { getSquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { ORIGIN_CLAIM_CLAUSE, SHIPPING_CLAIM_DETAIL, SHIPPING_CLAIM_SHORT } from "@/lib/commerce/policies";
import { swatchHex } from "@/lib/data/color-swatches";
import { isSellableProvider, isStorefrontPublic } from "@/lib/commerce/catalog-policy";
import { checkVariantPurchasable } from "@/lib/data/purchasable";

// 15 minutes: the PDP is served from the ISR cache and re-priced live at charge,
// so a longer window costs nothing in correctness and keeps first paint under the
// Doherty threshold for cold visits.
export const revalidate = 900;
// dynamicParams=false: only slugs present in generateStaticParams (every product
// in the local manifest) are valid. Any other slug — a deleted or never-existent
// product — returns a real HTTP 404 (Next's not-found) instead of the ISR
// soft-404 (a "Product Not Found" page served with a 200) that Netlify produced
// when notFound() ran inside an on-demand render. The manifest is the storefront
// source of truth and every new product ships with a redeploy, so no real product
// is ever missing from generateStaticParams.
export const dynamicParams = false;

// Prebuild every known PDP from the LOCAL manifest (no Square calls at build) so
// product pages are served from the ISR cache instead of a cold on-demand render
// (which re-paginated the whole Square catalog — the ~1.8s TTFB). Prices still
// refresh every 900s via `revalidate`, and the charge is re-priced live, so this
// changes nothing about how orders are priced.
export function generateStaticParams() {
  if (!isStorefrontPublic()) return [];
  try {
    // Only products with at least one SELLABLE variant. Mapping the whole
    // manifest here published every retired product as a real 200 page —
    // verified on the deploy preview, /product/dont-fuck-fascists-shirt served
    // fine. dynamicParams=false means this list IS the set of live PDPs, so the
    // provider filter has to be applied here and not only in the grid.
    return loadProducts()
      .filter((p) => p.variants.some((v) =>
        isSellableProvider(v.fulfillmentProvider) && checkVariantPurchasable(p, v).ok))
      .map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

const TITLE_SUFFIX = " | After Hours Agenda";

// Truncate at a word boundary (never mid-word) and add an ellipsis only when we
// actually cut. `max` is the visible character budget.
const truncateAtWord = (value: string, max: number) => {
  const text = value.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const productMetaTitle = (name: string) => {
  const stem = name;
  // Prefer the full product name (keyword-complete). Only truncate — at a word
  // boundary — when "<name> | After Hours Agenda" would exceed ~60 chars.
  const budget = 60 - TITLE_SUFFIX.length;
  return `${truncateAtWord(stem, budget)}${TITLE_SUFFIX}`;
};

// ---------------------------------------------------------------------------
// Meta description (M18)
// ---------------------------------------------------------------------------
// Truncating the PDP story at 155 chars ended every product description in the
// middle of a sentence. Compose from whole sentences inside the snippet budget
// instead: name + garment type + one differentiator + the honest shipping claim.
// `truncateAtWord` stays as a safety net but should never have to fire.
const META_DESCRIPTION_MAX = 160;

/** Garment nouns for the snippet. Mirrors the manifest's `productType` values. */
const META_TYPE_LABEL: Record<string, string> = {
  accessory: "accessory",
  hat: "headwear",
  hoodie: "hoodie",
  jacket: "jacket",
  sticker: "sticker",
  sweater: "sweatshirt",
  tee: "graphic tee",
};

const plainText = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").replace(/[—–]/g, "-").trim();

const asSentence = (value: string) => {
  const text = plainText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const firstSentence = (value: string) => {
  const text = plainText(value);
  return text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
};

function buildProductMetaDescription(
  product: Product,
  enrichment: ProductEnrichment | null,
  rawDescription: string,
): string {
  const typeLabel = META_TYPE_LABEL[enrichment?.productType ?? ""] ?? "piece";
  // Truth-in-advertising: the one shipping claim, from lib/commerce/policies.ts.
  const claim = `${SHIPPING_CLAIM_SHORT}, ${SHIPPING_CLAIM_DETAIL.toLowerCase()}.`;
  // ...and the one origin claim. This lead sentence opens every PDP snippet, so
  // "printed to order in NYC" put a false print location in front of the whole
  // catalog. Production is Huntington Park CA / Philadelphia PA; only the design
  // is NYC, which is exactly what ORIGIN_CLAIM_CLAUSE says.
  const lead = `${product.name}: ${typeLabel} ${ORIGIN_CLAIM_CLAUSE}.`;

  const sentences = [lead];
  const seen = new Set([lead.toLowerCase()]);
  for (const candidate of [firstSentence(rawDescription), enrichment?.fitDescription, enrichment?.fabricDescription]) {
    const sentence = asSentence(candidate ?? "");
    if (sentence.length < 16) continue;
    // Both phrases are already carried by the lead or the site name — spending
    // snippet budget on them again just makes every description read the same.
    if (/after hours agenda|printed to order/i.test(sentence)) continue;
    if (seen.has(sentence.toLowerCase())) continue;
    const next = `${sentences.join(" ")} ${sentence}`;
    if (next.length + 1 + claim.length > META_DESCRIPTION_MAX) continue;
    seen.add(sentence.toLowerCase());
    sentences.push(sentence);
  }

  return truncateAtWord(`${sentences.join(" ")} ${claim}`, META_DESCRIPTION_MAX);
}

// ---------------------------------------------------------------------------
// Colorway families (H5)
// ---------------------------------------------------------------------------
// Product titles follow "<design> - <colour> <garment>" ("Sheep Min - Maroon
// Unisex Hoodie"). Nine design families ship one Square product per colourway,
// and none of them linked to each other. The family key is derived here rather
// than consolidating the Square products, which would change indexed slugs.
const COLOR_WORDS = [
  "charcoal black triblend", "heather grey", "sport grey", "grey triblend", "dark heather",
  "dark grey", "dark gray", "light grey", "light gray", "dark tan", "true navy", "midnight navy",
  "navy blazer", "royal blue", "team royal", "flo blue", "ice blue", "burnt orange", "chalky mint",
  "military green", "forest green", "army green", "olive green",
  "black", "white", "cream", "ivory", "bone", "natural", "sand", "stone", "grey", "gray",
  "charcoal", "graphite", "pepper", "maroon", "burgundy", "crimson", "red", "navy", "blue",
  "chambray", "turquoise", "teal", "seafoam", "mint", "agave", "sage", "moss", "olive", "forest",
  "green", "lavender", "violet", "purple", "berry", "blossom", "pink", "crunchberry", "mustard",
  "yellow", "gold", "orange", "paprika", "rust", "brown", "tan", "camel", "khaki", "silver",
];

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

const titleCase = (value: string) =>
  value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

/** The design half of a title, shared by every garment carrying that graphic. */
const designStem = (name: string) => {
  const separator = name.indexOf(" - ");
  return separator > 0 ? normalizeKey(name.slice(0, separator)) : "";
};

/**
 * Same graphic AND same garment = the same product in a different colour. Keying
 * on both keeps a hoodie out of a sweatshirt's colourway row; the looser
 * `designStem` is what widens the related-products fallback below.
 */
function colorwayFamily(name: string): { key: string; color: string } | null {
  const separator = name.indexOf(" - ");
  if (separator < 0) return null;
  const stemKey = normalizeKey(name.slice(0, separator));
  const restKey = normalizeKey(name.slice(separator + 3));
  if (!stemKey || !restKey) return null;
  const color = COLOR_WORDS.find((word) => restKey === word || restKey.startsWith(`${word} `)) ?? "";
  const garmentKey = color ? restKey.slice(color.length).trim() : restKey;
  if (!garmentKey) return null;
  return { key: `${stemKey}|${garmentKey}`, color };
}

/**
 * Sibling colourways of `product`, in catalog order, including the product
 * itself so the row reads as a selector rather than an "elsewhere" list.
 * Returns [] unless there is at least one sibling to move to.
 */
function buildColorways(product: Product, products: Product[]): ColorwayOption[] {
  const family = colorwayFamily(product.name);
  if (!family) return [];
  const members = products.filter((candidate) => colorwayFamily(candidate.name)?.key === family.key);
  if (members.length < 2) return [];
  return members.map((member) => {
    const color = colorwayFamily(member.name)?.color ?? "";
    return {
      slug: member.slug,
      name: member.name,
      color: color ? titleCase(color) : "",
      hex: color ? swatchHex(color) : null,
      image: member.images[0] ?? "",
      current: member.id === product.id,
    };
  });
}

// ---------------------------------------------------------------------------
// Gallery assembly (M21)
// ---------------------------------------------------------------------------
// Square images are appended to the curated local mockups with no cap and no
// dedup, which pushed some galleries to 57 tiles. Keep every curated mockup
// (one front shot per colourway, and the colour->image map indexes into them),
// drop repeated URLs, and cap the Square tail so the strip stays scannable.
const GALLERY_CAP = 8;

function buildGallery(images: string[]): string[] {
  const seen = new Set<string>();
  const curated: string[] = [];
  const extra: string[] = [];
  for (const src of images) {
    if (!src || seen.has(src)) continue;
    seen.add(src);
    (src.startsWith("/products/") ? curated : extra).push(src);
  }
  return [...curated, ...extra.slice(0, Math.max(0, GALLERY_CAP - curated.length))];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const product = await getProduct(slug);
    if (!product) return { title: "Product Not Found" };

    const enrichment = getProductEnrichment(product.slug);
    const rawDescription = isAuthoredSquareDescription(product.description)
      ? product.description!.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      : buildProductStory(product, enrichment);
    const description = buildProductMetaDescription(product, enrichment, rawDescription);
    const image = product.images[0];
    const title = productMetaTitle(product.name);
    // Curated mockups under /products/ are all rendered at 800x800, so scrapers
    // can be told the box up front. Provider CDN images are not a known size —
    // omit the dimensions there rather than assert a wrong one.
    const imageCard = image
      ? {
          url: image,
          alt: product.name,
          ...(image.startsWith("/products/") ? { width: 800, height: 800 } : {}),
        }
      : null;

    return {
      title: { absolute: title },
      description,
      alternates: { canonical: `/product/${product.slug}` },
      openGraph: {
        title,
        description,
        type: "website",
        // Re-stated per page: a page-level openGraph object replaces the root
        // one wholesale, so omitting these dropped the site-name attribution
        // line and the locale from every product card.
        siteName: "After Hours Agenda",
        locale: "en_US",
        url: `/product/${product.slug}`,
        ...(imageCard && { images: [imageCard] }),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        ...(image && { images: [image] }),
      },
    };
  } catch (error) {
    console.error("Error generating product metadata:", error);
    return { title: "After Hours Agenda" };
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  // Do this before enrichment or stock work. A direct legacy PDP URL must not
  // fetch provider data while the migration hold is active.
  if (!isStorefrontPublic()) notFound();
  const { slug } = await params;
  let product: Product | null = null;
  let products: Product[] = [];

  // Enrichment is synchronous local-manifest data keyed by slug — start the live
  // Printful stock fetch in parallel with the Square catalog fetch instead of
  // waterfalling after it (removes one serial network hop from PDP TTFB).
  const enrichment = getProductEnrichment(slug);
  const stockPromise = enrichment
    ? getStockByCatId(Object.values(enrichment.catIdBySize)).catch(() => ({} as Record<number, boolean>))
    : Promise.resolve({} as Record<number, boolean>);
  const reviewsPromise = getProductReviews(slug);

  try {
    [product, products] = await Promise.all([
      getProduct(slug),
      getAllProducts(),
    ]);
  } catch (error) {
    console.error("Error loading product:", error);
    notFound();
  }

  if (!product) notFound();

  // Sibling colourways of this exact garment, rendered as a swatch row in the
  // buy block. Also excluded from "Related pieces" below so the same four
  // products do not appear twice on one page.
  const colorways = buildColorways(product, products);
  const colorwaySlugs = new Set(colorways.map((option) => option.slug));

  // Related products. Same collection first; then the design family (a title
  // like "Black Sheep - Bone ..." shares its stem with every other Black Sheep
  // piece); then the same product type. Collection-only left 31% of the catalog
  // — including all four Black Sheep sweatshirts — with zero outbound links.
  const others = products.filter((p) => p.id !== product!.id && !colorwaySlugs.has(p.slug));
  const stem = designStem(product.name);
  const related: Product[] = [];
  const relatedIds = new Set<string>();
  const addRelated = (candidates: Product[]) => {
    for (const candidate of candidates) {
      if (related.length >= 4) return;
      if (relatedIds.has(candidate.id)) continue;
      relatedIds.add(candidate.id);
      related.push(candidate);
    }
  };
  addRelated(others.filter((p) => p.collectionIds.some((id) => product!.collectionIds.includes(id))));
  if (related.length < 4 && stem) addRelated(others.filter((p) => designStem(p.name) === stem));
  if (related.length < 4 && enrichment?.productType) {
    // 62 of 113 products are tees. Rotating the scan by this product's catalog
    // position keeps the type fallback from pointing every uncollected tee at
    // the same first four, which is how link equity ends up in one corner.
    const position = products.findIndex((p) => p.id === product!.id);
    const offset = position > 0 && others.length > 0 ? position % others.length : 0;
    const rotated = [...others.slice(offset), ...others.slice(0, offset)];
    addRelated(rotated.filter((p) => getProductEnrichment(p.slug)?.productType === enrichment.productType));
  }

  // Prefer the human-authored Square description (the brand's actual copy) and
  // only fall back to the generated story when Square has nothing real. This
  // surfaces the per-product storytelling that was previously suppressed.
  const reviews = await reviewsPromise;
  const storyDescription = isAuthoredSquareDescription(product.description)
    ? product.description!
    : buildProductStory(product, enrichment);
  // JSON-LD needs plain text, not the authored HTML markup.
  const plainDescription = storyDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  // Live Printful stock per size (5-min fresh; fails open to in-stock).
  const stockBySize: Record<string, boolean> = {};
  if (enrichment) {
    const stock = await stockPromise;
    for (const [size, catId] of Object.entries(enrichment.catIdBySize)) {
      stockBySize[size] = stock[catId] ?? true;
    }
  }

  // Deduped, capped gallery. Every consumer below reads from this one list so
  // `colorImageIndex` can never point past the end of what the PDP renders.
  const galleryProduct: Product = { ...product, images: buildGallery(product.images) };

  // Map each sold color to the gallery image showing that colorway, matched
  // by the color slug embedded in the local mockup filename.
  const colorImageIndex: Record<string, number> = {};
  if (enrichment) {
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const claimed = new Set<number>();
    // Longest color names first so "True Navy" claims its image before "Navy".
    const colorsByLength = [...enrichment.colors].sort((a, b) => b.length - a.length);
    for (const color of colorsByLength) {
      const needle = normalize(color);
      if (!needle) continue;
      const index = galleryProduct.images.findIndex(
        (image, i) => !claimed.has(i) && image.startsWith("/products/") && normalize(image).includes(needle)
      );
      if (index >= 0) {
        colorImageIndex[color] = index;
        claimed.add(index);
      }
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${siteUrl}/shop` },
      { "@type": "ListItem", position: 3, name: product.name, item: `${siteUrl}/product/${product.slug}` },
    ],
  };

  return (
    <>
      <ProductJsonLd product={galleryProduct} description={plainDescription} reviews={reviews} enrichment={enrichment} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetail
        product={galleryProduct}
        related={related}
        enrichment={enrichment}
        stockBySize={stockBySize}
        storyDescription={storyDescription}
        colorImageIndex={colorImageIndex}
        colorways={colorways}
        reviews={reviews}
        squareConfig={getSquareWebPaymentsConfig()}
      />
    </>
  );
}
