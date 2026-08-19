import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/square/catalog";
import { getProductEnrichment } from "@/lib/data/enrichment";
import { splitProductName } from "@/lib/utils/product-name";
import { extractVariationSize } from "@/lib/utils/variation";
import { absolutizeImage } from "@/lib/utils/image-helpers";

// Meta Commerce Manager / Google Merchant Center product feed (CSV, one row per
// size). Scheduled-fetch this URL from Commerce Manager. Same catalog the
// storefront sells from, so it can never advertise a size or price we don't.
export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afterhoursagenda.com";

const GOOGLE_CATEGORY: Record<string, string> = {
  tee: "Apparel & Accessories > Clothing > Shirts & Tops",
  hoodie: "Apparel & Accessories > Clothing > Shirts & Tops",
  sweater: "Apparel & Accessories > Clothing > Shirts & Tops",
  jacket: "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
  hat: "Apparel & Accessories > Clothing Accessories > Hats",
  accessory: "Apparel & Accessories > Clothing Accessories",
  sticker: "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts",
};

const GARMENT_LABEL: Record<string, string> = { tee: "Graphic Tee", hoodie: "Hoodie", sweater: "Sweatshirt", jacket: "Jacket", hat: "Hat", sticker: "Sticker", accessory: "Accessory" };

const HEADERS = ["id", "item_group_id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link", "brand", "google_product_category", "product_type", "size", "color", "gender", "age_group", "material", "shipping"];

const csvCell = (value: string) => `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const plain = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export async function GET() {
  try {
    const products = await getAllProducts();
    const rows: string[][] = [];
    for (const product of products) {
      const enrichment = getProductEnrichment(product.slug);
      const { name, garment } = splitProductName(product.name);
      const groupId = product.variations.map((v) => v.sku).filter(Boolean)[0]?.replace(/-[A-Z0-9]+$/, "") ?? product.slug;
      const images = product.images.map((src) => absolutizeImage(src, BASE_URL));
      const description = plain(product.description || "").slice(0, 5000) || `${product.name} — made to order by After Hours Agenda.`;
      const category = GOOGLE_CATEGORY[enrichment?.productType ?? ""] ?? "Apparel & Accessories > Clothing";
      const color = enrichment?.colors?.[0] ?? "Black";
      const garmentLabel = GARMENT_LABEL[enrichment?.productType ?? ""] ?? garment ?? "";
      for (const variation of product.variations) {
        const size = extractVariationSize(variation.name);
        rows.push([
          variation.sku || `${groupId}-${size}`,
          groupId,
          `${name} ${garmentLabel}`.trim() + (size ? ` — ${size}` : ""),
          description,
          "in stock",
          "new",
          `${(variation.price / 100).toFixed(2)} ${product.currency || "USD"}`,
          `${BASE_URL}/product/${product.slug}`,
          images[0] ?? "",
          images.slice(1, 10).join(","),
          "After Hours Agenda",
          category,
          garmentLabel,
          size,
          color,
          "unisex",
          "adult",
          enrichment?.fabricDescription ?? "",
          "US::Standard:0.00 USD",
        ]);
      }
    }
    const csv = [HEADERS.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="after-hours-agenda-products.csv"',
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("meta feed failed", error);
    return new NextResponse("", { status: 503 });
  }
}
