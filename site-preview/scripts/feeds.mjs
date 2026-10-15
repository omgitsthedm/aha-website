import {readFile,mkdir,writeFile} from 'node:fs/promises';
const products=JSON.parse(await readFile(new URL('../src/data/products.json',import.meta.url),'utf8'));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const tag=(name,value)=>`<g:${name}>${escape(value)}</g:${name}>`;
function feedMetadata(product){
 if(!product.feed||typeof product.feed!=='object')throw new Error(`${product.slug} is missing required feed metadata.`);
 const {googleProductCategory,productType}=product.feed;
 if(typeof googleProductCategory!=='string'||!googleProductCategory.trim()||typeof productType!=='string'||!productType.trim())throw new Error(`${product.slug} has incomplete feed metadata.`);
 return {googleProductCategory,productType};
}
export async function writeFeeds(dist,origin){
 await mkdir(new URL('feeds/',dist),{recursive:true});
 const items=products.flatMap(product=>product.variants.map(variant=>{
  const {googleProductCategory,productType}=feedMetadata(product);
  const title=`${product.title} — ${product.color} — ${variant.size}`;
  const link=`${origin}/shop/${product.slug}/?size=${encodeURIComponent(variant.size)}`;
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
 const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0"><channel><title>After Hours Agenda — Shop</title><link>${escape(origin)}/shop/</link><description>Current After Hours Agenda collection</description>${items.join('')}</channel></rss>\n`;
 await writeFile(new URL('feeds/google.xml',dist),xml);
 await writeFile(new URL('feeds/meta.xml',dist),xml);
 await writeFile(new URL('_redirects',dist),'/feeds/meta /feeds/meta.xml 200\n/feeds/meta/ /feeds/meta.xml 200\n');
}
