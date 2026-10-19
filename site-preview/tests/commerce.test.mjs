import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const products=JSON.parse(await readFile(new URL('../src/data/products.json',import.meta.url),'utf8'));
const legacyYikes=Object.freeze([
 ['yikes-crewneck',52,['XS','S','M','L','XL','2XL','3XL']],
 ['yikes-cropped-hoodie',55,['XS','S','M','L','XL','2XL']],
]);
function unique(values,label){assert.equal(new Set(values).size,values.length,`${label} must be unique`);}
function xmlEscape(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');}

test('approved catalog records are expansion-safe and keep garment and campaign assets separate',async()=>{
 assert.ok(Array.isArray(products)&&products.length>0);
 unique(products.map(product=>product.slug),'product slugs');
 unique(products.map(product=>product.squareItemId),'Square item IDs');
 const variantIds=[];const supplierSkus=[];
 for(const product of products){
  assert.match(product.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(product.title,/\S/);assert.match(product.color,/\S/);assert.equal(product.currency,'USD');
  assert.match(product.feed?.googleProductCategory??'',/\S/);assert.match(product.feed?.productType??'',/\S/);
  assert.ok(Number.isFinite(product.price)&&product.price>0);
  assert.ok(Array.isArray(product.variants)&&product.variants.length>0);
  assert.deepEqual(product.gallery.map(shot=>shot.role).sort(),['back','folded','front','print-detail']);
  assert.ok(['front','back'].includes(product.gallery[0].role),'lead image must show a complete garment');
  assert.equal(product.campaign.length,3);
  for(const shot of product.campaign) if(shot.productSlug){
   const pictured=products.find(piece=>piece.slug===shot.productSlug);
   assert.ok(pictured,`${product.slug}: campaign must name an existing piece`);
   assert.equal(pictured.collection,product.collection,'shared campaign must stay in its collection');
  }
  for(const variant of product.variants){
   assert.match(variant.size,/\S/);assert.match(variant.id,/^[A-Z0-9]{20,30}$/);assert.match(variant.sku,/^APQ-\d+S\d+A1$/);
   variantIds.push(variant.id);supplierSkus.push(variant.sku);
  }
  const html=await readFile(new URL(`../dist/shop/${product.slug}/index.html`,import.meta.url),'utf8');
  assert.ok(!html.includes('square.link'));assert.ok(!html.includes('campaign-'));
  assert.equal((html.match(/<input\b[^>]*\bdata-cart-variant\b/g)||[]).length,product.variants.length);
  assert.ok(html.includes('ProductGroup'));assert.ok(!html.includes('New orders are paused'));
  for(const shot of [...product.gallery,...product.campaign]){
   assert.match(shot.feedImage,/^\/images\//);assert.match(shot.alt,/\S/);
   const image=await readFile(new URL(`../public${shot.feedImage}`,import.meta.url));
   assert.ok(image.includes(Buffer.from('trainedAlgorithmicMedia')));
  }
 }
 unique(variantIds,'Square variation IDs');unique(supplierSkus,'Apliiq SKUs');
});

test('Yikes remains the immutable 13-variant launch baseline',()=>{
 const yikes=products.filter(product=>product.slug.startsWith('yikes-'));
 assert.deepEqual(yikes.map(product=>[product.slug,product.price,product.variants.map(variant=>variant.size)]),legacyYikes);
 assert.equal(yikes.flatMap(product=>product.variants).length,13);
 assert.ok(yikes.every(product=>product.color==='Bone'));
});

test('Google and Meta feeds enumerate each approved variant with garment imagery only',async()=>{
 // Products off sale (src/data/off-sale.json) aren't in the built feeds.
 const {onSale}=await import('../server/catalog/off-sale.mjs');
 const variants=onSale(products).flatMap(product=>product.variants.map(variant=>({product,variant})));
 for(const name of ['google.xml','meta.xml']){
  const xml=await readFile(new URL(`../dist/feeds/${name}`,import.meta.url),'utf8');
  assert.equal((xml.match(/<item>/g)||[]).length,variants.length);
  for(const {product,variant} of variants){
   assert.ok(xml.includes(`<g:id>${variant.id}</g:id>`));
   assert.ok(xml.includes(`<g:item_group_id>${product.squareItemId}</g:item_group_id>`));
   assert.ok(xml.includes(`<g:title>${product.title} — ${product.color} — ${variant.size}</g:title>`));
   assert.ok(xml.includes(`<g:color>${product.color}</g:color>`));
   assert.ok(xml.includes(`<g:product_type>${xmlEscape(product.feed.productType)}</g:product_type>`));
   assert.ok(xml.includes(`<g:size>${variant.size}</g:size>`));
  }
  assert.equal((xml.match(/<g:additional_image_link>/g)||[]).length,variants.length*3);
  assert.equal((xml.match(/<g:structured_description>/g)||[]).length,variants.length);
  assert.ok(!xml.includes('campaign-'));assert.ok(!xml.includes('<g:gtin>'));
  assert.equal((xml.match(/<g:price>0\.00 USD<\/g:price>/g)||[]).length,variants.length);
 }
});
