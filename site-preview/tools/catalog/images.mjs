// Turns approved images into the storefront's derivative set: WebP at
// 400/800/full width plus a JPEG for feeds, each carrying the IPTC AI marker,
// and returns products.json gallery (4 garment views) and campaign entries.
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { APP, CatalogError } from "./lib.mjs";

const ROLES = ["front", "back", "print-detail", "folded"];
const MAX_WIDTH = 1122;
const AI_XMP = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"><Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

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

function roleFor(input, used) {
  const name = path.basename(String(input)).toLowerCase();
  const named = name.includes("detail") ? "print-detail" : ROLES.find((role) => new RegExp(`(^|[-_ /])${role}([-_. ]|$)`).test(name));
  if (named && !used.has(named)) return named;
  return ROLES.find((role) => !used.has(role));
}

/** Writes derivatives for one image; returns the entry fields shared by gallery and campaign. */
// Campaign photos lead the lookbook on phones, so they get a 680 px size and
// stronger compression (mobile LCP budget 2.5 s); garment shots stay crisp.
const PROFILES = {
  garment: { widths: [400, 800], webp: { quality: 82 } },
  campaign: { widths: [400, 680, 800], webp: { quality: 50, effort: 6, smartSubsample: true } },
};

async function derive({ folder, base, stem, input, fetchImpl, profile = "garment" }) {
  const settings = PROFILES[profile];
  const image = sharp(await source(input, fetchImpl)).rotate();
  const meta = await image.metadata();
  const full = Math.min(meta.width ?? MAX_WIDTH, MAX_WIDTH);
  const widths = [...new Set([...settings.widths, full].filter((width) => width <= full))].sort((a, b) => a - b);
  for (const width of widths) await image.clone().resize({ width }).withXmp(AI_XMP).webp(settings.webp).toFile(path.join(folder, `${stem}-${width}.webp`));
  await image.clone().resize({ width: full }).withXmp(AI_XMP).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(folder, `${stem}.jpg`));
  return {
    src: `${base}/${stem}-${full}.webp`,
    srcset: widths.map((width) => `${base}/${stem}-${width}.webp ${width}w`).join(", "),
    feedImage: `${base}/${stem}.jpg`,
    width: full,
    height: Math.round(((meta.height ?? full) * full) / (meta.width ?? full)),
  };
}

function place(slug, collection) {
  const folder = path.join(APP, "public/images", collectionSlug(collection), slug);
  mkdirSync(folder, { recursive: true });
  return { folder, base: `/images/${collectionSlug(collection)}/${slug}` };
}

export async function buildGallery({ slug, collection, title, color, inputs, alts = {}, fetchImpl = fetch }) {
  if (!inputs?.length) throw new CatalogError(`${slug}: at least one garment image is required.`, { code: "image_missing" });
  const { folder, base } = place(slug, collection);
  const used = new Set();
  const garment = `${color} ${title.replace(/^.*?(Crewneck|Hoodie|Long Sleeve|Pocket Long Sleeve|Cropped Hoodie)$/i, (match) => match)}`;
  const defaults = {
    front: `Front of the ${garment}.`,
    back: `Plain back of the ${garment}.`,
    "print-detail": `Close view of the ${title} print on ${color} fleece.`,
    folded: `${garment} casually folded.`,
  };
  const gallery = [];
  for (const input of inputs.slice(0, 4)) {
    const role = roleFor(input, used);
    used.add(role);
    gallery.push({ ...(await derive({ folder, base, stem: `garment-${role}`, input, fetchImpl })), alt: alts[role] ?? defaults[role], role });
  }
  return gallery.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
}

/** Three same-setting lifestyle images for the lookbook and marketing (never the shopping gallery or feeds). */
export async function buildCampaign({ slug, collection, title, color, setting, inputs, alts = [], fetchImpl = fetch }) {
  if (inputs?.length !== 3) throw new CatalogError(`${slug}: campaign needs exactly three images from one setting.`, { code: "campaign_count" });
  const { folder, base } = place(slug, collection);
  const stems = ["campaign-hero", "campaign-alternate-1", "campaign-alternate-2"];
  const campaign = [];
  for (const [index, input] of inputs.entries()) {
    const entry = await derive({ folder, base, stem: stems[index], input, fetchImpl, profile: "campaign" });
    campaign.push({ ...entry, alt: alts[index] ?? `${color} ${title} worn ${setting.toLowerCase()}.`, role: index === 0 ? "lifestyle-hero" : "lifestyle-alternate" });
  }
  return campaign;
}
