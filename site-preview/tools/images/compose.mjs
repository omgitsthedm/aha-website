// Deterministic garment shots: recolor a real blank-garment photo and lay the
// approved print on it. The artwork's pixels are only scaled and shaded by the
// fabric's own light, so the graphic can't be redrawn or altered.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BASES = JSON.parse(readFileSync(path.join(HERE, "bases.json"), "utf8"));

const hex = (value) => {
  const clean = value.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
};

async function raw(input, { width, height } = {}) {
  // Transparent studio backgrounds become white so the garment mask stays exact.
  let image = sharp(input).flatten({ background: "#ffffff" }).removeAlpha();
  if (width || height) image = image.resize({ width, height, fit: "fill" });
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * Garment mask: everything except the white studio background. Background is
 * near-white AND connected to the image edge, so bright fabric highlights
 * inside the garment stay garment.
 */
function garmentMask({ data, width, height, channels }) {
  const nearWhite = (i) => Math.min(data[i * channels], data[i * channels + 1], data[i * channels + 2]) >= 252;
  const background = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y += 1) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const i = stack.pop();
    if (background[i] || !nearWhite(i)) continue;
    background[i] = 1;
    const x = i % width, y = (i - x) / width;
    if (x > 0) stack.push(i - 1);
    if (x < width - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - width);
    if (y < height - 1) stack.push(i + width);
  }
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) mask[i] = background[i] ? 0 : 1;
  return mask;
}

function luminance(data, channels, i) {
  return (0.2126 * data[i * channels] + 0.7152 * data[i * channels + 1] + 0.0722 * data[i * channels + 2]) / 255;
}

/**
 * compose({ blank, view, color, art, widthInches, topInches, inkMode })
 *  - color: garment hex (approximate swatch until a photographed blank exists)
 *  - art: transparent PNG print master
 *  - widthInches / topInches: placement as specified to Apliiq
 * Returns { png, crop, printBox, inkMask } for QA and export.
 */
export async function compose({ blank, view = "front", color, art, widthInches, topInches = 3, centerOffsetInches = 0, background = "#ffffff" }) {
  const base = BASES[blank]?.[view];
  if (!base) throw new Error(`No ${view} base photo for ${blank}. Add one to tools/images/bases.json.`);
  const photo = await raw(path.join(HERE, base.file));
  const mask = garmentMask(photo);
  const { width, height, channels } = photo;
  // Fabric light relative to the garment's median brightness.
  const lums = [];
  for (let i = 0; i < width * height; i += 97) if (mask[i]) lums.push(luminance(photo.data, channels, i));
  lums.sort((a, b) => a - b);
  const median = lums[Math.floor(lums.length / 2)] || 1;
  const target = hex(color);
  const out = Buffer.from(photo.data);
  const shade = new Float32Array(width * height);
  const paper = hex(background);
  for (let i = 0; i < width * height; i += 1) {
    if (!mask[i]) { for (let c = 0; c < 3; c += 1) out[i * channels + c] = paper[c]; continue; }
    const s = Math.min(Math.max(luminance(photo.data, channels, i) / median, 0.25), 1.35);
    shade[i] = s;
    for (let c = 0; c < 3; c += 1) out[i * channels + c] = Math.min(255, Math.round(target[c] * s + (s > 1 ? (s - 1) * 40 : 0)));
  }
  // Place the print: width in inches → pixels, centered, a set distance below the collar.
  const pxPerInch = base.pxPerInch;
  const artMeta = await sharp(art).metadata();
  const printWidth = Math.round(widthInches * pxPerInch);
  const printHeight = Math.round((artMeta.height / artMeta.width) * printWidth);
  const left = Math.round(base.centerX + centerOffsetInches * pxPerInch - printWidth / 2);
  const top = Math.round(base.collarY + topInches * pxPerInch);
  const { data: ink, info } = await sharp(art).ensureAlpha().resize({ width: printWidth, height: printHeight, fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const inkMask = new Uint8Array(width * height);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const px = left + x, py = top + y;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const i = py * width + px;
      if (!mask[i]) continue;
      const k = (y * info.width + x) * 4;
      const alpha = ink[k + 3] / 255;
      if (alpha <= 0) continue;
      inkMask[i] = alpha > 0.5 ? 1 : 0;
      // Matte ink: follows folds at 70% of the fabric's contrast; no gloss.
      const s = 0.3 + 0.7 * shade[i];
      for (let c = 0; c < 3; c += 1) {
        const value = Math.min(255, ink[k + c] * s);
        out[i * channels + c] = Math.round(out[i * channels + c] * (1 - alpha) + value * alpha);
      }
    }
  }
  const png = await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
  return { png, width, height, printBox: { left, top, width: printWidth, height: printHeight }, inkMask, crop: base.crop };
}

/** Product-page frame (4:5), garment centered on paper white. */
export async function frame(png, crop, { width = 1122, background = "#ffffff" } = {}) {
  const height = Math.round(width * 1.25);
  const garment = await sharp(png).extract(crop).resize({ width: Math.round(width * 0.9), height: Math.round(height * 0.9), fit: "inside" }).toBuffer();
  return sharp({ create: { width, height, channels: 3, background } }).composite([{ input: garment, gravity: "center" }]).jpeg({ quality: 90 }).toBuffer();
}

/** Close-up of the print for the "print detail" shot. */
export async function detail(png, printBox, { width = 1122 } = {}) {
  const padX = Math.round(printBox.width * 0.08);
  const padY = Math.round(printBox.height * 0.08);
  const meta = await sharp(png).metadata();
  const left = Math.max(printBox.left - padX, 0);
  const top = Math.max(printBox.top - padY, 0);
  const regionWidth = Math.min(printBox.width + padX * 2, meta.width - left);
  const regionHeight = Math.min(Math.round(regionWidth * 1.25), meta.height - top);
  return sharp(png).extract({ left, top, width: regionWidth, height: regionHeight }).resize({ width, height: Math.round(width * 1.25), fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
}
