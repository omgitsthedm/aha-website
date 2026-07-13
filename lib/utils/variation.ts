/** Square variation labels may include a color before the apparel size. */
export function extractVariationSize(name: string): string {
  return name.split(/\s*(?:\/|,)\s*/).pop()?.trim().toUpperCase() || name.trim().toUpperCase();
}
