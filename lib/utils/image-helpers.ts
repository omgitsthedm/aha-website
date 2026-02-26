/**
 * Check if an image path is a local Printful PNG.
 * Used to conditionally apply object-contain and drop shadow styles.
 */
export function isPrintfulImage(src: string): boolean {
  return src.startsWith("/printful-assets/");
}
