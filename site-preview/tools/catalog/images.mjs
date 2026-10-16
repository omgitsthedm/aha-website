// Turns approved garment images (Apliiq mockups or local files) into the
// storefront's derivative set: WebP at 400/800/full width plus a JPEG for the
// Google/Meta feeds, and returns products.json gallery entries.
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { APP, CatalogError } from "./lib.mjs";

const ROLES = ["front", "back", "detail", "folded"];
const ROLE_TEXT = { front: "Front", back: "Back", detail: "Print detail", folded: "Folded view" };
const MAX_WIDTH = 1122;

export const collectionSlug = (collection) => collection.toLowerCase().normalize("NFKD").replace(/[̀-ͯ’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function source(input, fetchImpl) {
  if (/^https?:\/\//.test(input) || input.startsWith("//")) {
    const url = input.startsWith("//") ? `https:${input}` : input;
    if (!url.startsWith("https://")) throw new CatalogError(`Image ${input} must be HTTPS.`, { code: "image_invalid" });
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new CatalogError(`Image download failed (${response.status}): ${url}`, { code: "image_download" });
    return Buffer.from(await response.arrayBuffer());
  }
  return readFileSync(path.resolve(APP, input));
}

export async function buildGallery({ slug, collection, title, color, inputs, fetchImpl = fetch }) {
  if (!inputs?.length) throw new CatalogError(`${slug}: at least one garment image is required.`, { code: "image_missing" });
  const folder = path.join(APP, "public/images", collectionSlug(collection), slug);
  mkdirSync(folder, { recursive: true });
  const base = `/images/${collectionSlug(collection)}/${slug}`;
  const gallery = [];
  for (const [index, input] of inputs.slice(0, 4).entries()) {
    const role = ROLES[index];
    const image = sharp(await source(input, fetchImpl)).rotate();
    const meta = await image.metadata();
    const full = Math.min(meta.width ?? MAX_WIDTH, MAX_WIDTH);
    const widths = [...new Set([400, 800, full].filter((width) => width <= full))];
    for (const width of widths) await image.clone().resize({ width }).webp({ quality: 82 }).toFile(path.join(folder, `garment-${role}-${width}.webp`));
    await image.clone().resize({ width: full }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(folder, `garment-${role}.jpg`));
    const height = Math.round(((meta.height ?? full) * full) / (meta.width ?? full));
    gallery.push({
      src: `${base}/garment-${role}-${full}.webp`,
      srcset: widths.map((width) => `${base}/garment-${role}-${width}.webp ${width}w`).join(", "),
      feedImage: `${base}/garment-${role}.jpg`,
      alt: `${ROLE_TEXT[role]} of the ${color} ${title}.`,
      width: full,
      height,
      role,
    });
  }
  return gallery;
}
