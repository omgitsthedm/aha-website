import { getProductEnrichment, type ProductEnrichment } from "@/lib/data/enrichment";
import { absolutizeImage } from "@/lib/utils/image-helpers";
import { splitProductName } from "@/lib/utils/product-name";
import type { Product } from "@/lib/utils/types";
import { extractVariationColor, extractVariationSize } from "@/lib/utils/variation";

const GOOGLE_CATEGORY: Record<string, string> = {
  tee: "Apparel & Accessories > Clothing > Shirts & Tops",
  hoodie: "Apparel & Accessories > Clothing > Shirts & Tops",
  sweater: "Apparel & Accessories > Clothing > Shirts & Tops",
  jacket: "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
  hat: "Apparel & Accessories > Clothing Accessories > Hats",
  accessory: "Apparel & Accessories > Clothing Accessories",
  sticker: "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts",
};

const GARMENT_LABEL: Record<string, string> = {
  tee: "Graphic Tee",
  hoodie: "Hoodie",
  sweater: "Sweatshirt",
  jacket: "Jacket",
  hat: "Hat",
  sticker: "Sticker",
  accessory: "Accessory",
};

const META_HEADERS = [
  "id", "item_group_id", "title", "description", "availability", "condition", "price", "link",
  "image_link", "additional_image_link", "brand", "google_product_category", "product_type", "size",
  "color", "gender", "age_group", "material", "identifier_exists", "shipping",
];

export interface ChannelListing {
  id: string;
  groupId: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  brand: "After Hours Agenda";
  googleProductCategory: string;
  productType: string;
  size: string;
  color: string;
  gender: "unisex";
  ageGroup: "adult";
  material: string;
  identifierExists: false;
  shipping: "US::Standard:0.00 USD";
}

type EnrichmentResolver = (slug: string) => ProductEnrichment | null;

const xml = (value: string | number) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const plain = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
const csvCell = (value: string) => `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

/**
 * Projects the already-public Square catalog into one channel-neutral, sellable
 * variant listing per row. All feed formats must render this result rather than
 * independently deriving identifiers, taxonomy, or availability.
 */
export function buildChannelListings(
  products: Product[],
  baseUrl: string,
  resolveEnrichment: EnrichmentResolver = getProductEnrichment,
): ChannelListing[] {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return products.flatMap((product) => {
    const enrichment = resolveEnrichment(product.slug);
    // getAllProducts is already provider and purchasability filtered. Recheck
    // the manifest's per-size rail here so stale/mocked Square rows cannot be
    // advertised when checkout would reject them.
    if (!enrichment) return [];

    const { name, garment } = splitProductName(product.name);
    const groupId = product.variations.map((variation) => variation.sku).find(Boolean)?.replace(/-[A-Z0-9]+$/, "") ?? product.slug;
    const images = product.images.map((src) => absolutizeImage(src, normalizedBaseUrl));
    const imageLink = images[0];
    if (!imageLink) return [];

    const description = plain(product.description || "").slice(0, 5000) || `${product.name} — made to order by After Hours Agenda.`;
    const category = GOOGLE_CATEGORY[enrichment.productType] ?? "Apparel & Accessories > Clothing";
    const garmentLabel = GARMENT_LABEL[enrichment.productType] ?? garment ?? "";

    return product.variations.flatMap((variation) => {
      const size = extractVariationSize(variation.name);
      if (!enrichment.purchasableBySize[size]?.ok) return [];

      const color = extractVariationColor(variation.name) || enrichment.colors[0] || "Black";
      return [{
        id: variation.sku || `${groupId}-${size}`,
        groupId,
        title: `${name} ${garmentLabel}`.trim() + (size ? ` — ${size}` : ""),
        description,
        price: (variation.price / 100).toFixed(2),
        currency: product.currency || "USD",
        link: `${normalizedBaseUrl}/product/${product.slug}`,
        imageLink,
        additionalImageLinks: images.slice(1, 10),
        brand: "After Hours Agenda",
        googleProductCategory: category,
        productType: garmentLabel,
        size,
        color,
        gender: "unisex",
        ageGroup: "adult",
        material: enrichment.fabricDescription,
        identifierExists: false,
        shipping: "US::Standard:0.00 USD",
      }];
    });
  });
}

export function buildMetaProductFeed(listings: ChannelListing[]): string {
  const rows = listings.map((listing) => [
    listing.id, listing.groupId, listing.title, listing.description, "in stock", "new",
    `${listing.price} ${listing.currency}`, listing.link, listing.imageLink,
    listing.additionalImageLinks.join(","), listing.brand, listing.googleProductCategory,
    listing.productType, listing.size, listing.color, listing.gender, listing.ageGroup,
    listing.material, String(listing.identifierExists), listing.shipping,
  ]);
  return [META_HEADERS.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

export function buildGoogleProductFeed(listings: ChannelListing[], baseUrl: string): string {
  const channelLink = baseUrl.replace(/\/$/, "");
  const items = listings.map((listing) => `<item><g:id>${xml(listing.id)}</g:id><g:item_group_id>${xml(listing.groupId)}</g:item_group_id><title>${xml(listing.title)}</title><description>${xml(listing.description)}</description><link>${xml(listing.link)}</link><g:image_link>${xml(listing.imageLink)}</g:image_link>${listing.additionalImageLinks.map((image) => `<g:additional_image_link>${xml(image)}</g:additional_image_link>`).join("")}<g:availability>in_stock</g:availability><g:condition>new</g:condition><g:price>${xml(listing.price)} ${xml(listing.currency)}</g:price><g:brand>${xml(listing.brand)}</g:brand><g:google_product_category>${xml(listing.googleProductCategory)}</g:google_product_category><g:product_type>${xml(listing.productType)}</g:product_type><g:size>${xml(listing.size)}</g:size><g:color>${xml(listing.color)}</g:color><g:gender>${xml(listing.gender)}</g:gender><g:age_group>${xml(listing.ageGroup)}</g:age_group><g:material>${xml(listing.material)}</g:material><g:identifier_exists>${listing.identifierExists}</g:identifier_exists><g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>0.00 USD</g:price></g:shipping></item>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>After Hours Agenda</title><link>${xml(channelLink)}</link><description>Active made-to-order After Hours Agenda catalog</description>${items}</channel></rss>`;
}

/** Backwards-compatible exporter retained for /product-feed.xml callers. */
export function buildProductFeed(
  products: Product[],
  baseUrl: string,
  resolveEnrichment: EnrichmentResolver = getProductEnrichment,
): string {
  return buildGoogleProductFeed(buildChannelListings(products, baseUrl, resolveEnrichment), baseUrl);
}
