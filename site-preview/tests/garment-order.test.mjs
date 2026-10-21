import test from 'node:test';
import assert from 'node:assert/strict';
import { GARMENT_GROUPS, garmentGroup, garmentsInOrder } from '../server/catalog/garments.mjs';
import products from '../src/data/products.json' with { type: 'json' };
import { onSale } from '../server/catalog/off-sale.mjs';

test('the shop leads with cropped hoodies and tees, then orders pieces by garment style', () => {
  const original = structuredClone(products);
  const ordered = onSale(garmentsInOrder(products));
  assert.equal(ordered[0].typeLabel, 'Cropped hoodie');
  const lightLayers = ordered.filter(p => ['cropped-hoodies', 'tees'].includes(garmentGroup(p.typeLabel)));
  assert.equal(lightLayers.length, 7);
  assert.deepEqual(ordered.slice(0, lightLayers.length), lightLayers);
  const rank = product => GARMENT_GROUPS.findIndex(group => group.key === garmentGroup(product.typeLabel));
  for (let i = 1; i < ordered.length; i++) assert.ok(rank(ordered[i - 1]) <= rank(ordered[i]));
  assert.deepEqual(products, original, 'merchandising must not mutate product or provider records');
  assert.deepEqual(garmentsInOrder([{ typeLabel: 'Unknown' }, { typeLabel: 'Hoodie' }]).map(p => p.typeLabel), ['Hoodie', 'Unknown']);
});
