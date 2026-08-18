#!/usr/bin/env node
/**
 * Pre-encode the editorial LCP images as static AVIF + WebP at fixed widths.
 *
 *   node scripts/imagery/encode-editorial.mjs
 *
 * The heroes are the largest contentful paint on the home, lookbook and about
 * pages. Serving them from `public/editorial/opt/` as pre-encoded files (via
 * <EditorialPicture>) instead of the on-demand `/_next/image` optimizer means:
 * real AVIF (the optimizer path only ever returned WebP on the CDN), a quality
 * chosen per image, no first-hit encode, and a byte budget we can assert on.
 *
 * Re-run after swapping any file listed in SOURCES. Output is committed.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "public", "editorial", "opt");

/** name → { src, widths, avif quality, webp quality }. Widths never exceed the source. */
export const SOURCES = {
  "hero-her": { src: "editorial/hero-her.jpg", widths: [480, 640, 750, 900], avif: 42, webp: 62 },
  "hero-him": { src: "editorial/hero-him.jpg", widths: [480, 640, 750, 900], avif: 42, webp: 62 },
  "subway-platform": { src: "editorial/subway-platform.jpg", widths: [640, 828, 1080, 1440, 1600], avif: 44, webp: 62 },
  "2012-the-prologue": { src: "editorial/archive/2012-the-prologue.jpg", widths: [480, 640, 750, 1080], avif: 42, webp: 62 },
};

await mkdir(OUT, { recursive: true });
/** Written to public/editorial/opt/manifest.json; read by lib/content/editorial-optimized.ts. */
const manifest = {};
for (const [name, spec] of Object.entries(SOURCES)) {
  const input = path.join(ROOT, "public", spec.src);
  const meta = await sharp(input).metadata();
  const widths = spec.widths.filter((width) => width <= (meta.width ?? width));
  manifest[`/${spec.src}`] = { name, widths, width: meta.width, height: meta.height };
  for (const width of widths) {
    const base = sharp(input).resize({ width, withoutEnlargement: true });
    const avifPath = path.join(OUT, `${name}-${width}.avif`);
    const webpPath = path.join(OUT, `${name}-${width}.webp`);
    await base.clone().avif({ quality: spec.avif, effort: 6, chromaSubsampling: "4:2:0" }).toFile(avifPath);
    await base.clone().webp({ quality: spec.webp, effort: 6 }).toFile(webpPath);
    const [a, w] = await Promise.all([stat(avifPath), stat(webpPath)]);
    console.log(`  ${name}-${width}: avif ${(a.size / 1024).toFixed(1)} KB · webp ${(w.size / 1024).toFixed(1)} KB`);
  }
}
await writeFile(path.join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`  manifest → public/editorial/opt/manifest.json (${Object.keys(manifest).length} sources)`);
