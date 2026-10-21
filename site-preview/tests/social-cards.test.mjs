import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import cards from '../src/data/social-cards.json' with { type: 'json' };
import products from '../src/data/products.json' with { type: 'json' };
import { collectionsInOrder, collectionSlug } from '../src/data/collections.ts';
import { photosFor } from '../src/data/photography.ts';
import { onSale } from '../server/catalog/off-sale.mjs';
import client from '../client.config.json' with { type: 'json' };

test('all current product, design and editorial links have versioned 1200×630 previews', async () => {
  const active = onSale(products);
  const paths = ['/', '/shop/', '/lookbook/', '/about/', ...active.map(p => `/shop/${p.slug}/`), ...collectionsInOrder(active).map(([name]) => `/shop/${collectionSlug(name)}/`)];
  assert.deepEqual(Object.keys(cards).sort(), paths.sort());
  for (const path of paths) {
    const card = cards[path];
    assert.equal(card.width, 1200, path); assert.equal(card.height, 630, path);
    const bytes = await readFile(new URL(`../public${card.src}`, import.meta.url));
    assert.ok(bytes.length < 500000, `${path}: keep shared cards compact`);
    assert.ok(card.src.endsWith(`-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.jpg`), path);
    assert.ok(bytes.includes(Buffer.from('compositeSynthetic')), path);
    for (const source of card.sources) await readFile(new URL(`../public${source}`, import.meta.url));
    const html = await readFile(new URL(`../dist${path}index.html`, import.meta.url), 'utf8');
    for (const property of ['og:image', 'twitter:image'])
      assert.ok(html.includes(`${property}" content="${new URL(card.src, process.env.AHA_PRODUCTION_BUILD === 'approved' ? client.site.origin : client.site.previewOrigin).href}"`), path);
    assert.ok(html.includes('property="og:image:width" content="1200"'), path);
    assert.ok(html.includes('property="og:image:height" content="630"'), path);
  }
});

test('product cards use their exact garment and never a different color’s campaign photo', () => {
  for (const product of onSale(products)) {
    const card = cards[`/shop/${product.slug}/`];
    assert.ok(product.gallery.some(shot => shot.feedImage === card.sources[0]), product.slug);
    const ownPhotos = photosFor(product).filter(shot => !shot.productSlug || shot.productSlug === product.slug);
    assert.ok([...product.gallery, ...ownPhotos].some(shot => (shot.feedImage || shot.src) === card.sources[1]), product.slug);
  }
});
