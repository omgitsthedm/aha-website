/**
 * Check if an image path is a locally hosted Printful asset — either raw
 * print art (/printful-assets/) or a verified garment mockup (/products/).
 * Both are transparent flat-lays that render with object-contain instead of
 * object-cover, so they never crop the garment.
 */
export function isPrintfulImage(src: string): boolean {
  return src.startsWith("/printful-assets/") || src.startsWith("/products/");
}
