/**
 * Check if an image path is a locally hosted Printful asset — either raw
 * print art (/printful-assets/) or a verified garment mockup (/products/).
 * Both are transparent flat-lays that render with object-contain instead of
 * object-cover, so they never crop the garment.
 */
export function isPrintfulImage(src: string): boolean {
  return src.startsWith("/printful-assets/") || src.startsWith("/products/");
}

/**
 * Make an image reference absolute for consumers that require a full URL —
 * Google Merchant feed image_link and Product JSON-LD image[]. Already-absolute
 * CDN URLs (Printful, Square S3) pass through unchanged; site-relative paths are
 * resolved against the canonical origin. `baseUrl` must not have a trailing slash.
 */
export function absolutizeImage(src: string, baseUrl: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
}
