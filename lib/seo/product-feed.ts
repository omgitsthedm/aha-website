import type { Product } from "@/lib/utils/types";
import { absolutizeImage } from "@/lib/utils/image-helpers";

const xml = (value: string | number) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const textOnly = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const sizeFromVariation = (value: string) => value.split("/").pop()?.trim() || value.trim();

export function buildProductFeed(products: Product[], baseUrl: string): string {
  const items = products.flatMap((product) => product.variations.map((variation) => {
    const description = textOnly(product.description) || `${product.name}, made to order by After Hours Agenda.`;
    const title = product.variations.length > 1 ? `${product.name} - ${variation.name}` : product.name;
    // Google Merchant requires absolute image URLs; site-relative asset paths
    // would be disapproved. CDN URLs pass through unchanged.
    const image = product.images[0] ? absolutizeImage(product.images[0], baseUrl) : undefined;
    const additionalImages = product.images.slice(1, 10).map((url) => `<g:additional_image_link>${xml(absolutizeImage(url, baseUrl))}</g:additional_image_link>`).join("");
    return `<item><g:id>${xml(variation.sku || variation.id)}</g:id><g:item_group_id>${xml(product.id)}</g:item_group_id><title>${xml(title)}</title><description>${xml(description)}</description><link>${xml(`${baseUrl}/product/${product.slug}`)}</link>${image ? `<g:image_link>${xml(image)}</g:image_link>` : ""}${additionalImages}<g:availability>in_stock</g:availability><g:condition>new</g:condition><g:price>${xml((variation.price / 100).toFixed(2))} ${xml(product.currency || "USD")}</g:price><g:brand>After Hours Agenda</g:brand><g:size>${xml(sizeFromVariation(variation.name))}</g:size><g:identifier_exists>false</g:identifier_exists><g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>0.00 USD</g:price></g:shipping></item>`;
  }));

  return `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>After Hours Agenda</title><link>${xml(baseUrl)}</link><description>Active made-to-order After Hours Agenda catalog</description>${items.join("")}</channel></rss>`;
}
