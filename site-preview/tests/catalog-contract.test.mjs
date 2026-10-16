import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {AHA_FULFILLMENT_CATALOG,AHA_PRIVATE_LABEL} from '../server/fulfillment/catalog.mjs';
import {DOMESTIC_SHIPPING_CENTS,INTERNATIONAL_SHIPPING_CENTS,appliesArizonaTax} from '../server/checkout/catalog.mjs';

const products=JSON.parse(await readFile(new URL('../src/data/products.json',import.meta.url),'utf8'));
const legacyYikes=Object.freeze({
 KZFZMSVPRMY3MOC7I3TQ2B5O:['APQ-6208401S5A1','XS',5200,'crewneck'],
 RKGX6H4FU6NBGAGHKXECXUBE:['APQ-6208401S6A1','S',5200,'crewneck'],
 R5UCZCGSJMR3Z4HJDVOD3ZIK:['APQ-6208401S7A1','M',5200,'crewneck'],
 '3CAFSZ345DL6VRX5CNBI6YDQ':['APQ-6208401S8A1','L',5200,'crewneck'],
 '45VCO6MGNJTUGR6UZYLG7Y43':['APQ-6208401S1A1','XL',5200,'crewneck'],
 UFYWTQK4GQFOQVYNINTCCL62:['APQ-6208401S2A1','2XL',5200,'crewneck'],
 OPKNVVYLRSTI6OY75G67HY6E:['APQ-6208401S21A1','3XL',5200,'crewneck'],
 UXOOJLWOXLDU32KXPFVBB6CU:['APQ-6208412S5A1','XS',5500,'cropped_hoodie'],
 ATOF65IIPKIZWFT3QDJMON4R:['APQ-6208412S6A1','S',5500,'cropped_hoodie'],
 WFAIFUKSQXCUDRHPTMAWO2UM:['APQ-6208412S7A1','M',5500,'cropped_hoodie'],
 '4HDYVGQA3ZOGIPYFUCTPKPIV':['APQ-6208412S8A1','L',5500,'cropped_hoodie'],
 YG2VANIT6R4SUQ3MWPZK74YI:['APQ-6208412S1A1','XL',5500,'cropped_hoodie'],
 KEQN72Y22B5RL3V5NFVACNWQ:['APQ-6208412S2A1','2XL',5500,'cropped_hoodie'],
});
const cityDesigns=Object.freeze({
 'the-city-ss4500-black':{designId:6210771,priceCents:5800,sizes:['XS','S','M','L','XL','2XL','3XL','4XL','5XL']},
 'the-city-ss3000-black':{designId:6210772,priceCents:5500,sizes:['XS','S','M','L','XL','2XL','3XL']},
 'the-city-next-level-3601-black':{designId:6211233,priceCents:4200,sizes:['S','M','L','XL','2XL']},
});

test('every approved storefront variation has one exact fulfillment allowlist mapping',()=>{
 const storefront=new Map();
 for(const product of products)for(const variant of product.variants){
  assert.ok(!storefront.has(variant.id),`duplicate storefront variation ${variant.id}`);
  storefront.set(variant.id,{sku:variant.sku,size:variant.size,priceCents:Math.round(product.price*100)});
 }
 assert.deepEqual([...Object.keys(AHA_FULFILLMENT_CATALOG)].sort(),[...storefront.keys()].sort());
 for(const [variationId,expected] of storefront){
  const mapped=AHA_FULFILLMENT_CATALOG[variationId];
  assert.equal(mapped.sku,expected.sku,variationId);assert.equal(mapped.size,expected.size,variationId);assert.equal(mapped.priceCents,expected.priceCents,variationId);
  assert.match(mapped.product,/^[a-z0-9_]+$/);
 }
});

test('the private label, delivery and tax launch contracts remain pinned as catalog grows',()=>{
 assert.equal(AHA_PRIVATE_LABEL,'SB-3-161622');
 assert.equal(DOMESTIC_SHIPPING_CENTS,0);assert.equal(INTERNATIONAL_SHIPPING_CENTS,2500);
 assert.equal(appliesArizonaTax({country:'US',region:'AZ',postalCode:'85345'}),true);
 assert.equal(appliesArizonaTax({country:'US',region:'NY',postalCode:'10001'}),false);
});

test('the original Yikes mappings remain exact even after approved catalog expansion',()=>{
 const actual=Object.fromEntries(Object.entries(AHA_FULFILLMENT_CATALOG).filter(([id])=>id in legacyYikes).map(([id,value])=>[id,[value.sku,value.size,value.priceCents,value.product]]));
 assert.deepEqual(actual,legacyYikes);
});

test('expanded Insomniac catalog records retain a customer-facing title and color without changing Yikes',()=>{
 const insomniac=products.filter(product=>product.collection==='Insomniac');
 const longSleeveDesigns={'insomniac-next-level-3601-black':6211255,'insomniac-next-level-3601-heather-grey':6209285};
 if(insomniac.length===0){assert.equal(products.length,2);return;}
 assert.equal(insomniac.length,8);
 for(const product of insomniac)for(const variant of product.variants){
  const mapped=AHA_FULFILLMENT_CATALOG[variant.id];
  assert.ok(mapped,`${product.slug} ${variant.size} missing fulfillment mapping`);
  assert.equal(mapped.sku,variant.sku,`${product.slug} ${variant.size} changed decorated SKU`);
  assert.equal(mapped.title,`${product.title} — ${product.color}`,`${product.slug} requires its own fulfillment title`);
  if(product.slug in longSleeveDesigns)assert.match(variant.sku,new RegExp(`^APQ-${longSleeveDesigns[product.slug]}S[0-9]+A1$`),`${product.slug} exact verified supplier design`);
 }
 assert.equal(AHA_FULFILLMENT_CATALOG.R5UCZCGSJMR3Z4HJDVOD3ZIK.title,undefined,'Yikes remains on the explicit legacy-title fallback');
});

test('The City keeps all 21 approved variants, back-first imagery, the exact supplier designs, and the private-label contract',()=>{
 const city=products.filter(product=>product.collection==='The City');
 assert.equal(city.length,3);
 assert.deepEqual(city.map(product=>product.slug).sort(),Object.keys(cityDesigns).sort());
 let variants=0;
 for(const product of city){
  const expected=cityDesigns[product.slug];
  assert.equal(product.color,'Black',`${product.slug} color`);
  assert.equal(Math.round(product.price*100),expected.priceCents,`${product.slug} price`);
  assert.deepEqual(product.gallery.map(image=>image.role),['back','front','print-detail','folded'],`${product.slug} gallery order`);
  assert.deepEqual(product.variants.map(variant=>variant.size),expected.sizes,`${product.slug} sizes`);
  for(const variant of product.variants){
   variants+=1;
   const mapped=AHA_FULFILLMENT_CATALOG[variant.id];
   assert.ok(mapped,`${product.slug} ${variant.size} missing fulfillment mapping`);
   assert.equal(mapped.sku,variant.sku,`${product.slug} ${variant.size} decorated SKU`);
   assert.equal(mapped.size,variant.size,`${product.slug} ${variant.size} mapped size`);
   assert.equal(mapped.priceCents,expected.priceCents,`${product.slug} ${variant.size} mapped price`);
   assert.equal(mapped.product,product.slug.replaceAll('-','_'),`${product.slug} product mapping`);
   assert.equal(mapped.title,`${product.title} — ${product.color}`,`${product.slug} fulfillment title`);
   // Apliiq's decorated SKU encodes the verified design ID. This pins each
   // storefront variation to the exact supplier design without trusting a
   // browser-submitted SKU or a mutable provider label.
   assert.match(variant.sku,new RegExp(`^APQ-${expected.designId}S[0-9]+A1$`),`${product.slug} exact supplier design`);
  }
 }
 assert.equal(variants,21);
 assert.equal(AHA_PRIVATE_LABEL,'SB-3-161622');
});
