import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import versions from '../src/data/image-versions.json' with { type: 'json' };
import { imageUrl, imageSrcset } from '../server/catalog/image-urls.mjs';

test('immutable photographs are content-addressed byte-for-byte copies', async () => {
  assert.ok(Object.keys(versions).length > 0);
  for (const [source, target] of Object.entries(versions)) {
    const original = await readFile(new URL(`../public${source}`, import.meta.url));
    const copy = await readFile(new URL(`../public${target}`, import.meta.url));
    assert.deepEqual(copy, original, source);
    assert.ok(target.includes(createHash('sha256').update(original).digest('hex').slice(0, 24)), source);
  }
  const source = Object.keys(versions)[0];
  assert.equal(imageSrcset(`${source} 400w, /images/future.webp 800w`), `${versions[source]} 400w, /images/future.webp 800w`);
  assert.equal(imageUrl('/images/future.webp'), '/images/future.webp', 'New live products keep working without a new map');
});

test('only versioned image URLs receive immutable caching', async () => {
  const headers = await readFile(new URL('../dist/_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/images\/immutable\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/images\/\*\n\s+Cache-Control: public, max-age=86400\b/);
});
