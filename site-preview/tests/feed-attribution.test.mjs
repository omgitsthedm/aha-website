import test from 'node:test';
import assert from 'node:assert/strict';
import products from '../src/data/products.json' with {type:'json'};
import {feedXml} from '../scripts/feeds.mjs';
import {handleFeeds} from '../netlify/functions/catalog-feeds.mjs';

const links = xml => [...xml.matchAll(/<g:link>([^<]+)<\/g:link>/g)].map(([,link]) => new URL(link.replaceAll('&amp;','&')));

test('shopping channel attribution preserves every exact product and size', () => {
 const variants=products.flatMap(product=>product.variants.map(variant=>({product,variant})));
 for(const channel of ['google','meta']){
  const urls=links(feedXml(products,'https://afterhoursagenda.com',channel));
  assert.equal(urls.length,variants.length);
  urls.forEach((url,index)=>{
   assert.equal(url.pathname,`/shop/${variants[index].product.slug}/`);
   assert.equal(url.searchParams.get('size'),variants[index].variant.size);
   assert.equal(url.searchParams.get('utm_source'),channel);
   assert.equal(url.searchParams.get('utm_medium'),channel==='google'?'organic':'organic_social');
   assert.equal(url.searchParams.get('utm_campaign'),'shopping');
  });
 }
 assert.throws(()=>feedXml(products,'https://afterhoursagenda.com','unsupported'));
});

test('runtime feeds use the same attributed links as the static build and exclude retired products', async()=>{
 const saleProducts=products.slice(0,2);
 const catalog=async()=>({saleProducts,saleLiveProducts:[]});
 for(const channel of ['google','meta']){
  const response=await handleFeeds(new Request(`https://afterhoursagenda.com/feeds/${channel}.xml`),{deploy:{context:'production'}},{catalog});
  assert.equal(await response.text(),feedXml(saleProducts,'https://afterhoursagenda.com',channel));
 }
});
