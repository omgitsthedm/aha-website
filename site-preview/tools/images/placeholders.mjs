// Two-tone placeholders for campaign and editorial photos: the average color of
// each photo's top and bottom halves, painted behind it while it loads. Garment
// shots are skipped (they can have transparent backgrounds a tint would show
// through). Run `npm run images:placeholders` after adding or replacing photos;
// tests/premium.test.mjs fails until every photo has one.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../../", import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
const products = await read("src/data/products.json");
const editorial = await read("src/data/images.json");
const sources = [...new Set([...products.flatMap((product) => product.campaign.map((shot) => shot.src)), ...Object.values(editorial).map((image) => image.src)])].sort();
const hex = (r, g, b) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
const placeholders = {};
for (const src of sources) {
  const { data } = await sharp(fileURLToPath(new URL(`public${src}`, root))).removeAlpha().resize(1, 2, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  placeholders[src] = [hex(data[0], data[1], data[2]), hex(data[3], data[4], data[5])];
}
await writeFile(new URL("src/data/placeholders.json", root), `${JSON.stringify(placeholders, null, 2)}\n`);
console.log(`Wrote ${sources.length} photo placeholders.`);
