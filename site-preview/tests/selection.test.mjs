import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recoverSelection } from '../src/scripts/selection.ts';
const products = JSON.parse(await readFile(new URL('../src/data/products.json', import.meta.url), 'utf8'));
const variants = products.flatMap(p => p.variants.map(v => ({ ...v, slug: p.slug, title: p.title, price: p.price })));

test('Meta IDs and supplier SKUs recover the same size without accepting URL prices', () => {
  const result = recoverSelection('?products=KEQN72Y22B5RL3V5NFVACNWQ%3A2%2CAPQ-6208401S8A1%3A2&price=1', variants);
  assert.deepEqual(result.lines.map(v => [v.slug, v.size, v.quantity, v.price]), [['yikes-cropped-hoodie', '2XL', 2, 55], ['yikes-crewneck', 'L', 2, 52]]);
  assert.equal(result.incomplete, false);
});

test('unknown, retired, negative, fractional and excessive quantities cannot become purchasable selections', () => {
  for (const entry of ['retired:1', 'APQ-6208401S8A1:-1', 'APQ-6208401S8A1:0', 'APQ-6208401S8A1:1.5', 'APQ-6208401S8A1:21', 'APQ-6208401S8A1:2:extra', 'APQ-6208401S8A1:Infinity']) {
    const result = recoverSelection(`?products=${encodeURIComponent(entry)}`, variants);
    assert.equal(result.lines.length, 0, entry);
    assert.equal(result.incomplete, true, entry);
  }
  assert.equal(recoverSelection('?products='+'a'.repeat(4097), variants).incomplete, true);
});

test('duplicates merge only within the cap and a bad line does not erase valid selections', () => {
  const result = recoverSelection('?products=APQ-6208401S8A1:2,3CAFSZ345DL6VRX5CNBI6YDQ:3,retired:1', variants);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].quantity, 5);
  assert.equal(result.incomplete, true);
});

test('recovery page remains outside the sitemap and explicitly tells crawlers not to index it', async () => {
  const html = await readFile(new URL('../dist/checkout/index.html', import.meta.url), 'utf8');
  assert.match(html, /name="robots" content="noindex, noarchive"/);
  const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  assert.ok(!sitemap.includes('/checkout'));
});
