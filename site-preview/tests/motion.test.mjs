import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const products = await read("../src/data/products.json");
const motion = await read("../src/data/motion.json");
const campaignSrcs = new Set(products.flatMap((product) => product.campaign.map((shot) => shot.src)));

// Top-level MP4 boxes, in file order.
function boxes(buffer) {
  const found = [];
  for (let at = 0; at + 8 <= buffer.length;) {
    const size = buffer.readUInt32BE(at);
    found.push(buffer.toString("latin1", at + 4, at + 8));
    if (size < 8) break;
    at += size;
  }
  return found;
}

test("every film plays over a campaign photo, credits its city footage and records its AI garment shots", () => {
  assert.ok(Object.keys(motion).length > 0);
  for (const [src, film] of Object.entries(motion)) {
    assert.ok(campaignSrcs.has(src), `${src} is a current campaign photo`);
    assert.match(film.large, /^\/motion\/[a-z0-9-]+\.mp4$/);
    assert.match(film.small, /^\/motion\/[a-z0-9-]+\.mp4$/);
    assert.match(film.tall, /^\/motion\/[a-z0-9-]+\.mp4$/);
    assert.ok(film.seconds > 2 && film.seconds <= 14);
    assert.match(film.label, /AI-generated/, "the caption says the garment shots are AI-generated");
    assert.match(film.label, /Pexels/, "the caption says where the city footage comes from");
    assert.ok(film.city.length > 0 && film.city.every((clip) => Number.isInteger(clip.pexels) && clip.creator));
    assert.ok(film.garments.length > 0);
    for (const shot of film.garments) {
      assert.ok(campaignSrcs.has(shot.photo), `${shot.photo} is a current campaign photo`);
      assert.ok(Number.isInteger(shot.seed));
      assert.match(shot.generator, /AI/);
    }
  }
});

test("film files are small, silent, start playing before they finish downloading", async () => {
  for (const clip of Object.values(motion)) {
    for (const [path, limit] of [[clip.large, 1_200_000], [clip.small, 700_000], [clip.tall, 700_000]]) {
      const buffer = await readFile(new URL(`../public${path}`, import.meta.url));
      assert.ok(buffer.length < limit, `${path} is ${buffer.length} bytes; keep it under ${limit}`);
      const order = boxes(buffer);
      assert.equal(order[0], "ftyp");
      assert.ok(order.indexOf("moov") < order.indexOf("mdat"), `${path} needs faststart (moov before mdat)`);
      const handlers = [];
      for (let at = buffer.indexOf("hdlr"); at !== -1; at = buffer.indexOf("hdlr", at + 4)) handlers.push(buffer.toString("latin1", at + 12, at + 16));
      assert.ok(handlers.includes("vide"));
      assert.ok(!handlers.includes("soun"), `${path} must have no audio track`);
    }
  }
});

test("built pages carry films only on labeled campaign photos", async () => {
  const page = async (path) => readFile(new URL(`../dist/${path}`, import.meta.url), "utf8");
  const home = await page("index.html");
  const lookbook = await page("lookbook/index.html");
  for (const html of [home, lookbook]) {
    const figures = html.match(/<figure[^>]*>[\s\S]*?<\/figure>/g) ?? [];
    const moving = figures.filter((figure) => figure.includes("data-motion="));
    if (html === lookbook) assert.ok(moving.length > 0);
    for (const figure of moving) assert.match(figure, /class="motion-note">[^<]*AI-generated[^<]*Pexels|class="motion-note">[^<]*Pexels[^<]*AI-generated/, "a film's caption says what is real and what is AI-generated");
  }
  const hero = home.match(/<section class="hero-composition[^>]*>[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.ok(hero, "the home hero remains the approved photo composition");
  assert.match(hero, /<picture>/);
  assert.match(hero, /image\/avif/);
  assert.ok(!hero.includes('data-motion='), "the approved hero animates type and frames, never the garment photographs");
  assert.match(lookbook, /Films pair licensed city footage with AI-generated garment shots/);
  // The photo stays the page's main image: no video element ships in the HTML.
  assert.doesNotMatch(home + lookbook, /<video/);
});
