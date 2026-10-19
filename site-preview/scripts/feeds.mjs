import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import products from '../src/data/products.json' with {type:'json'};
import {releasedProducts} from '../server/catalog/drops.mjs';
import {onSale} from '../server/catalog/off-sale.mjs';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const tag=(name,value)=>`<g:${name}>${escape(value)}</g:${name}>`;
function feedMetadata(product){
 if(!product.feed||typeof product.feed!=='object')throw new Error(`${product.slug} is missing required feed metadata.`);
 const {googleProductCategory,productType}=product.feed;
 if(typeof googleProductCategory!=='string'||!googleProductCategory.trim()||typeof productType!=='string'||!productType.trim())throw new Error(`${product.slug} has incomplete feed metadata.`);
 return {googleProductCategory,productType};
}
/** Google/Meta feed XML. Live products (published without a deploy) reuse this at runtime. */
export function feedXml(list,origin,channel='google'){
 if(!['google','meta'].includes(channel))throw new Error('Unsupported shopping feed channel.');
 const items=list.flatMap(product=>product.variants.map(variant=>{
  const {googleProductCategory,productType}=feedMetadata(product);
  const title=`${product.title} — ${product.color} — ${variant.size}`;
  // Both Meta shops share this feed; do not mislabel Instagram visits as Facebook.
  const link=`${origin}/shop/${product.slug}/?size=${encodeURIComponent(variant.size)}&utm_source=${channel}&utm_medium=${channel==='google'?'organic':'organic_social'}&utm_campaign=shopping`;
  return '<item>'+[
   tag('id',variant.id),tag('item_group_id',product.squareItemId),tag('title',title),tag('description',product.description),
   `<g:structured_title>${tag('digital_source_type','trained_algorithmic_media')}${tag('content',title)}</g:structured_title>`,
   `<g:structured_description>${tag('digital_source_type','trained_algorithmic_media')}${tag('content',product.description)}</g:structured_description>`,
   tag('link',link),tag('image_link',origin+product.gallery[0].feedImage),
   ...product.gallery.slice(1).map(image=>tag('additional_image_link',origin+image.feedImage)),
   tag('availability','in_stock'),tag('condition','new'),tag('price',`${product.price.toFixed(2)} USD`),tag('brand','After Hours Agenda'),tag('identifier_exists','no'),
   tag('google_product_category',googleProductCategory),tag('product_type',productType),
   tag('color',product.color),tag('size',variant.size),tag('size_system','US'),tag('size_type','regular'),tag('gender',product.gender),tag('age_group','adult'),tag('material',product.composition),tag('custom_label_0','FW26'),
   `<g:shipping>${tag('country','US')}${tag('service','Standard')}${tag('price','0.00 USD')}</g:shipping>`
  ].join('')+'</item>';
 }));
 return `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>After Hours Agenda — Shop</title><link>${escape(origin)}/shop/</link><description>Current After Hours Agenda collection</description>${items.join('')}</channel></rss>\n`;
}
/**
 * OpenAI product feed (ChatGPT shopping), OpenAI format as JSON Lines: one row
 * per size, required fields plus variant grouping. Search only; checkout in
 * ChatGPT needs a separate integration. Delivered by SFTP (see
 * .github/workflows/openai-feed.yml) once the merchant account exists.
 */
export function openAiFeedJsonl(list,origin){
 return list.flatMap(product=>product.variants.map(variant=>JSON.stringify({
  item_id:variant.id,
  title:`${product.title} — ${product.color} — ${variant.size}`,
  description:product.description,
  url:`${origin}/shop/${product.slug}/?size=${encodeURIComponent(variant.size)}`,
  brand:'After Hours Agenda',
  seller_name:'After Hours Agenda',
  image_url:origin+product.gallery[0].feedImage,
  availability:'in_stock',
  price:`${product.price.toFixed(2)} USD`,
  is_eligible_search:true,
  is_eligible_checkout:false,
  group_id:product.squareItemId,
  listing_has_variations:true,
  variant_dict:{color:product.color,size:variant.size},
  color:product.color,
  size:variant.size,
  gender:product.gender,
  material:product.composition,
 }))).join('\n')+'\n';
}
/**
 * Gzip that is byte-identical on every build machine: Node writes no timestamp,
 * and the header's OS byte (macOS 19, Linux 3) is pinned to 3 so a local build
 * reproduces Netlify's artifact digest.
 */
export const gzipFeed=(text)=>{const out=gzipSync(Buffer.from(text),{level:9});out[9]=3;return out;};

export async function writeFeeds(dist,origin){
 await mkdir(new URL('feeds/',dist),{recursive:true});
 // Drops not yet open to everyone, and products off sale, stay out.
 const listed=releasedProducts(onSale(products));
 await writeFile(new URL('feeds/google.xml',dist),feedXml(listed,origin,'google'));
 await writeFile(new URL('feeds/meta.xml',dist),feedXml(listed,origin,'meta'));
 await writeFile(new URL('feeds/openai.jsonl.gz',dist),gzipFeed(openAiFeedJsonl(listed,origin)));
 await writeFile(new URL('_redirects',dist),'/feeds/meta /feeds/meta.xml 200\n/feeds/meta/ /feeds/meta.xml 200\n');
}
