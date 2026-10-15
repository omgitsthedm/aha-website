import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const products=JSON.parse(await readFile(new URL('../src/data/products.json',import.meta.url),'utf8'));
test('launch catalog has the agreed prices, size maps, four garment views and three separate campaign views',async()=>{
 assert.equal(products.length,2);
 assert.deepEqual(products.map(p=>[p.slug,p.price,p.variants.map(v=>v.size)]),[
  ['yikes-crewneck',52,['XS','S','M','L','XL','2XL','3XL']],
  ['yikes-cropped-hoodie',55,['XS','S','M','L','XL','2XL']]
 ]);
 for(const p of products){
  assert.equal(p.color,'Bone');assert.equal(p.gallery.length,4);assert.equal(p.campaign.length,3);
  assert.equal(new URL(p.checkoutUrl).hostname,'square.link');
  const html=await readFile(new URL(`../dist/shop/${p.slug}/index.html`,import.meta.url),'utf8');
  assert.ok(html.includes(p.checkoutUrl));assert.ok(!html.includes('campaign-'));
  assert.ok(html.includes('ProductGroup'));assert.ok(!html.includes('New orders are paused'));
  for(const shot of [...p.gallery,...p.campaign]){
   const image=await readFile(new URL(`../public${shot.feedImage}`,import.meta.url));
   assert.ok(image.includes(Buffer.from('trainedAlgorithmicMedia')));
  }
 }
});
test('Google and Meta feeds contain only the 13 current variants and garment imagery',async()=>{
 const ids=products.flatMap(p=>p.variants.map(v=>v.id));
 for(const name of ['google.xml','meta.xml']){
  const xml=await readFile(new URL(`../dist/feeds/${name}`,import.meta.url),'utf8');
  assert.equal((xml.match(/<item>/g)||[]).length,13);
  for(const id of ids)assert.ok(xml.includes(`<g:id>${id}</g:id>`));
  assert.equal((xml.match(/<g:additional_image_link>/g)||[]).length,39);
  assert.equal((xml.match(/<g:structured_description>/g)||[]).length,13);
  assert.ok(!xml.includes('campaign-'));assert.ok(!xml.includes('<g:gtin>'));
  assert.ok(xml.includes('<g:price>0.00 USD</g:price>'));
 }
});
