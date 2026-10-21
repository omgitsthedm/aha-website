// Render reviewed product pixels and approved campaign photographs into link cards.
// Run manually after a photography/catalog update; normal builds use committed assets.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectionsInOrder, collectionSlug } from '../../src/data/collections.ts';
import { photosFor } from '../../src/data/photography.ts';
import { onSale } from '../../server/catalog/off-sale.mjs';
import products from '../../src/data/products.json' with { type: 'json' };

const publicRoot = new URL('../../public/', import.meta.url);
const folder = 'brand/share-fw26-20261020';
await mkdir(new URL(`${folder}/`, publicRoot), { recursive: true });
const asset = async path => {
  const extension = path.split('.').at(-1);
  const type = extension === 'woff2' ? 'font/woff2' : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  return `data:${type};base64,${(await readFile(new URL(path.replace(/^\//, ''), publicRoot))).toString('base64')}`;
};
const bold = await asset('/fonts/poppins-latin-700.woff2');
const mono = await asset('/fonts/jetbrains-mono-400.woff2');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fullPrint = product => product.gallery.find(shot => shot.role === (['Insomniac', 'The City', 'For the Record'].includes(product.collection) ? 'back' : 'front')) ?? product.gallery[0];
const ownPhotos = product => photosFor(product).filter(shot => !shot.productSlug || shot.productSlug === product.slug);
const still = shot => ({ src: shot.feedImage || shot.src, fit: 'cover' });
const garment = shot => ({ src: shot.feedImage || shot.src, fit: 'contain' });
const cards = [{
  path: '/', slug: 'home', title: 'GET COMFORTABLE MAKING AN IMPRESSION.', subtitle: 'Graphic tees, soft fleece and ribbed knitwear.',
  panels: [still(ownPhotos(products.find(p => p.slug === 'nonna-s-sunday-supper-society-c1717-ivory'))[0]), garment(fullPrint(products.find(p => p.slug === 'yikes-cropped-hoodie'))), still(ownPhotos(products.find(p => p.slug === 'fashion-kills-3023cl-black'))[0])],
}];
const active = onSale(products);
cards.push({ path: '/shop/', slug: 'shop', title: 'YOUR NEXT FAVORITE.', subtitle: 'Graphic tees, soft fleece and ribbed knitwear.', panels: ['nonna-s-sunday-supper-society-c1717-ivory', 'mighty-micks-ss3000-navy', 'after-hours-agenda-heritage-beanie-sp12-black'].map(slug => garment(fullPrint(products.find(p => p.slug === slug)))) });
cards.push({ path: '/lookbook/', slug: 'lookbook', title: 'OUT & ABOUT IT.', subtitle: 'Fall / Winter 2026 · AI-generated campaign photography', panels: ['nonna-s-sunday-supper-society-c1717-ivory', 'yikes-cropped-hoodie', 'mighty-micks-ss3000-navy'].map(slug => still(ownPhotos(products.find(p => p.slug === slug))[0])) });
cards.push({ path: '/about/', slug: 'story', title: 'STARTED WITH A T-SHIRT.', subtitle: 'Independent clothing · Established 2011', panels: [still(ownPhotos(products.find(p => p.slug === 'nonna-s-sunday-supper-society-c1717-ivory'))[1]), garment(fullPrint(products.find(p => p.slug === 'nonna-s-sunday-supper-society-c1717-ivory')))] });
for (const product of active) {
  const photo = ownPhotos(product)[0];
  cards.push({ path: `/shop/${product.slug}/`, slug: product.slug, title: product.title, subtitle: `${product.color} · ${product.typeLabel}${photo ? ' · AI-generated campaign photograph' : ''}`, panels: [garment(fullPrint(product)), photo ? still(photo) : garment(product.gallery.find(shot => shot.role === 'folded') ?? product.gallery[1])] });
}
for (const [name, pieces] of collectionsInOrder(active)) {
  const lead = pieces.find(product => ownPhotos(product).length) ?? pieces[0];
  const photo = ownPhotos(lead)[0];
  cards.push({ path: `/shop/${collectionSlug(name)}/`, slug: `design-${collectionSlug(name)}`, title: name, subtitle: `Fall / Winter 2026${photo ? ' · AI-generated campaign photograph' : ''}`, panels: [garment(fullPrint(lead)), photo ? still(photo) : garment(pieces.at(-1).gallery[0])] });
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const manifest = {};
try {
  for (const card of cards) {
    const panels = await Promise.all(card.panels.map(async panel => `<figure class="${panel.fit}"><img src="${await asset(panel.src)}" /></figure>`));
    await page.setContent(`<!doctype html><html><head><style>@font-face{font-family:P;src:url('${bold}');font-weight:700}@font-face{font-family:M;src:url('${mono}')}*{box-sizing:border-box}body{margin:0;background:#FAFAFA;color:#1A1A1A;font-family:P}header{height:66px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;font-size:22px}header span,small{font-family:M;font-weight:400;font-size:16px}main{display:grid;grid-template-columns:repeat(${panels.length},1fr);gap:1px;background:#ddd;height:444px;border-block:1px solid #ddd}figure{margin:0;background:#fff;min-width:0;overflow:hidden}.cover{background:#FAFAFA}img{height:100%;width:100%;display:block;object-fit:contain}.contain img{object-fit:contain;padding:10px 20px}footer{height:120px;padding:15px 32px 13px;border-bottom:7px solid #FF6B6B}h1{font-size:${card.title.length > 46 ? 28 : 32}px;line-height:1.18;letter-spacing:-.8px;margin:0 0 9px}small{font-size:16px}</style></head><body><header>AFTER HOURS AGENDA<span>FALL / WINTER 2026</span></header><main>${panels.join('')}</main><footer><h1>${escape(card.title)}</h1><small>${escape(card.subtitle)}</small></footer></body></html>`);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    const fits = await page.locator('footer').evaluate(footer => footer.scrollHeight <= footer.clientHeight);
    if (!fits) throw new Error(`Card text overflows: ${card.path}`);
    const raw = await page.screenshot({ type: 'jpeg', quality: 92 });
    // Keep an accurate synthetic-composite disclosure in exported JPEG metadata.
    const xmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic"/></rdf:RDF></x:xmpmeta>');
    const marker = Buffer.alloc(4); marker.writeUInt16BE(0xffe1); marker.writeUInt16BE(xmp.length + 2, 2);
    const output = Buffer.concat([raw.subarray(0, 2), marker, xmp, raw.subarray(2)]);
    const hash = createHash('sha256').update(output).digest('hex').slice(0, 12);
    const src = `/${folder}/${card.slug}-${hash}.jpg`;
    await writeFile(new URL(src.slice(1), publicRoot), output);
    manifest[card.path] = { src, width: 1200, height: 630, alt: `${card.title} — ${card.subtitle}`, sources: card.panels.map(panel => panel.src) };
  }
} finally { await browser.close(); }
await writeFile(new URL('../../src/data/social-cards.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
const current = new Set(Object.values(manifest).map(card => card.src.split('/').at(-1)));
for (const file of await readdir(new URL(`${folder}/`, publicRoot)))
  if (file.endsWith('.jpg') && !current.has(file)) await unlink(new URL(`${folder}/${file}`, publicRoot));
console.log(`Prepared ${cards.length} current, versioned link-preview cards.`);
