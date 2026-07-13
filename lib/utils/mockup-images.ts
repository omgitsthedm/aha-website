import fs from "fs";
import path from "path";

/**
 * Verified garment-mockup gallery per product slug.
 * Generated from the Printful mockup library: every image was matched to its
 * product by exact title, garment blank, and sold colorway before inclusion.
 * Source of the mapping: data/product-images.json (build-time, server-only).
 */
function loadMockupMap(): Record<string, string[]> {
  try {
    const file = path.join(process.cwd(), "data", "product-images.json");
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string[]>;
  } catch {
    return {};
  }
}

const mockupMap = loadMockupMap();

/** Ordered garment mockups for a product slug ([] when none verified). */
export function getMockupImages(slug: string): string[] {
  return mockupMap[slug] ?? [];
}
