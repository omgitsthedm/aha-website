import fs from "fs";
import path from "path";

/**
 * Normalize a string for fuzzy matching between Square product names
 * and Printful PNG filenames. Strips all special characters, lowercases,
 * and collapses whitespace to single spaces.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // strip everything except letters, numbers, spaces
    .replace(/\s+/g, " ")        // collapse whitespace
    .trim();
}

/**
 * Build a lookup map from normalized product names to Printful PNG paths.
 * Reads the public/printful-assets directory at build time (server-side only).
 * The map keys are normalized names, values are URL paths like /printful-assets/File.png
 */
function buildPrintfulMap(): Map<string, string> {
  const map = new Map<string, string>();

  try {
    const dir = path.join(process.cwd(), "public", "printful-assets");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));

    for (const file of files) {
      // Filename without .png, underscores become spaces for normalization
      const rawName = file.slice(0, -4).replace(/_/g, " ");
      const key = normalize(rawName);
      // Store as URL path (public/ maps to /)
      map.set(key, `/printful-assets/${file}`);
    }
  } catch {
    // Silently fail if directory doesn't exist (e.g. during client-side import)
  }

  return map;
}

// Build once at module load (server-side only during ISR/SSG)
const printfulMap = buildPrintfulMap();

/**
 * Look up a local Printful PNG for a Square product name.
 * Returns the URL path (e.g. /printful-assets/Alter_Ego.png) or null if no match.
 */
export function getPrintfulImage(productName: string): string | null {
  const key = normalize(productName);

  // Exact normalized match
  if (printfulMap.has(key)) {
    return printfulMap.get(key)!;
  }

  // Fallback: substring match for names that normalize slightly differently
  const entries = Array.from(printfulMap.entries());
  for (let i = 0; i < entries.length; i++) {
    const [mapKey, url] = entries[i];
    if (key.includes(mapKey) || mapKey.includes(key)) {
      return url;
    }
  }

  return null;
}
