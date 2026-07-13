export interface DesignSource {
  title: string;
  productSlug: string;
  image: string;
  sourceFile: string;
  alt: string;
}

/**
 * Storefront previews tied back to the maintained Desktop design library.
 * Keep sourceFile relative to the client root so it remains portable across machines.
 */
export const DESIGN_SOURCES: readonly DesignSource[] = [
  {
    title: "Social Club",
    productSlug: "social-club",
    image: "/printful-assets/Social_Club.png",
    sourceFile: "Products/Social Club/Mockup - Black - Mens Fitted T Shirt - Front.png",
    alt: "Black Social Club graphic T-shirt",
  },
  {
    title: "Not A $220 Sweater",
    productSlug: "not-a-220-sweater-navy-unisex-premium-sweatshirt",
    image: "/printful-assets/Not_A__220_Sweater_-_Navy_Unisex_Premium_Sweatshirt.png",
    sourceFile: "printful-file-library/Not A $220 Sweater/911671688 - Not A 220 Sweater.png",
    alt: "Navy Not A $220 Sweater sweatshirt",
  },
  {
    title: "Flower Shop",
    productSlug: "unisex-flower-shop-comfort-colors",
    image: "/printful-assets/Unisex_Flower_Shop__Comfort_Colors.png",
    sourceFile: "printful-file-library/Flower Shop/845967970 - Flower Shop.png",
    alt: "Black Flower Shop graphic T-shirt",
  },
  {
    title: "No Place Like New York",
    productSlug: "no-place-like-new-york-charcoal-unisex-premium-sweatshirt",
    image: "/printful-assets/No_Place_Like_New_York_-_Charcoal_Unisex_Premium_Sweatshirt.png",
    sourceFile: "printful-file-library/No Place Like New York/911067162 - No Place Like New York - Final.png",
    alt: "Charcoal No Place Like New York sweatshirt",
  },
] as const;
