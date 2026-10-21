import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const products = await read("../src/data/products.json");
const editorial = await read("../src/data/images.json");
const placeholders = await read("../src/data/placeholders.json");
const photography = await read("../src/data/photography.json");

test("every campaign and editorial photo has a two-tone placeholder; garment shots have none", () => {
  const photos = [...products.flatMap((product) => product.campaign.map((shot) => shot.src)), ...Object.values(editorial).map((image) => image.src), ...Object.values(photography).flatMap(set => set.photos.map(shot => shot.src))];
  const missing = photos.filter((src) => !placeholders[src]);
  assert.deepEqual(missing, [], "run npm run images:placeholders after adding photos");
  for (const tones of Object.values(placeholders)) assert.ok(tones.length === 2 && tones.every((tone) => /^#[0-9a-f]{6}$/.test(tone)));
  const garments = products.flatMap((product) => product.gallery.map((shot) => shot.src));
  assert.deepEqual(garments.filter((src) => placeholders[src]), [], "garment shots can be transparent; never tint them");
});

test("the browser bar matches the page and prerendering is limited to product pages", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<meta name="theme-color" content="#FF6B6B">/);
  const manifest = JSON.parse(await readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.theme_color, "#ff6b6b");
  const rules = JSON.parse(html.match(/<script type="speculationrules">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(rules.prerender[0].where.and[0], { href_matches: "/shop/*" });
  assert.deepEqual(rules.prefetch[0].where.and[1].not.href_matches, ["/shop/*", "/admin/*", "/api/*", "/checkout/*"]);
  assert.ok([...rules.prerender, ...rules.prefetch].every((rule) => rule.eagerness === "moderate"), "only on hover or press, never eagerly");
});
