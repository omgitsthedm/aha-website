export {};
type Consent={analytics:boolean;marketing:boolean;at:number};
type Queue=((...args:unknown[])=>void)&{queue?:unknown[][];loaded?:boolean;version?:string;callMethod?:(...args:unknown[])=>void;push?:Queue};
declare global {interface Window {dataLayer:unknown[];gtag:(...args:unknown[])=>void;fbq?:Queue;_fbq?:Queue;}}
const banner=document.querySelector<HTMLElement>('.cookie-banner');
const enabled=banner?.dataset.trackingEnabled==='true';
const key='aha-cookie-choices-v1';
const maxAge=180*24*60*60*1000;
const gpc=(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true;
let consent:Consent|undefined;
try{const raw=JSON.parse(localStorage.getItem(key)||'null');if(raw&&typeof raw.analytics==='boolean'&&typeof raw.marketing==='boolean'&&Date.now()-raw.at<maxAge)consent=raw;}catch{/* Storage is optional. */}
function insert(src:string){const script=document.createElement('script');script.async=true;script.src=src;document.head.append(script);}
function cleanLocation(){const url=new URL(location.pathname,location.origin);const search=new URLSearchParams(location.search);for(const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=search.get(name);if(value&&value.length<150)url.searchParams.set(name,value);}return url.href;}
function product(){const node=document.querySelector<HTMLElement>('[data-product-id]');return node?{item_id:node.dataset.productId,item_name:node.dataset.productName,price:Number(node.dataset.productPrice),item_brand:'After Hours Agenda',item_variant:'Bone',quantity:1}:null;}
function activate(value:Consent){
 if(!enabled)return;
 const item=product();
 if(value.analytics&&banner?.dataset.gaId){
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  window.gtag('consent','update',{analytics_storage:'granted'});
  window.gtag('js',new Date());
  window.gtag('config',banner.dataset.gaId,{page_location:cleanLocation(),page_referrer:document.referrer?new URL(document.referrer).origin:'',allow_google_signals:false,allow_ad_personalization_signals:false,send_page_view:true});
  if(item)window.gtag('event','view_item',{currency:'USD',value:item.price,items:[item]});
  insert(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(banner.dataset.gaId)}`);
 }
 if(value.marketing&&!gpc&&banner?.dataset.metaId){
  const queue:Queue=function(...args:unknown[]){if(queue.callMethod)queue.callMethod(...args);else queue.queue?.push(args);};
  queue.queue=[];queue.loaded=true;queue.version='2.0';queue.push=queue;
  window.fbq=queue;window._fbq=queue;
  queue('consent','grant');queue('set','autoConfig',false,banner.dataset.metaId);queue('init',banner.dataset.metaId);queue('track','PageView');
  if(item)queue('track','ViewContent',{content_ids:[item.item_id],content_type:'product_group',content_name:item.item_name,value:item.price,currency:'USD'});
  insert('https://connect.facebook.net/en_US/fbevents.js');
 }
}
function clearCookies(){for(const entry of document.cookie.split(';')){const name=entry.trim().split('=')[0] || '';if(!/^(_ga|_gid|_gat|_fbp|_fbc)/.test(name))continue;for(const domain of ['',`; domain=${location.hostname}`,'; domain=.afterhoursagenda.com'])document.cookie=`${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;}}
if(consent)activate(consent);else if(banner)banner.hidden=false;
document.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach(button=>button.addEventListener('click',()=>{
 const value={analytics:button.dataset.consent!=='essential',marketing:button.dataset.consent==='all'&&!gpc,at:Date.now()};
 try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Choice applies to this page. */}
 if(banner)banner.hidden=true;
 if(consent){window.fbq?.('consent','revoke');window.gtag?.('consent','update',{analytics_storage:'denied'});clearCookies();location.reload();return;}
 consent=value;activate(value);
}));
document.querySelectorAll<HTMLButtonElement>('[data-privacy-settings]').forEach(button=>button.addEventListener('click',()=>{if(banner){banner.hidden=false;banner.querySelector<HTMLButtonElement>('button')?.focus();}}));
document.querySelector<HTMLAnchorElement>('[data-checkout-link]')?.addEventListener('click',()=>{
 const item=product();if(!item||!enabled)return;
 if(consent?.analytics)window.gtag?.('event','begin_checkout',{currency:'USD',value:item.price,items:[item]});
 if(consent?.marketing&&!gpc)window.fbq?.('track','InitiateCheckout',{content_ids:[item.item_id],content_type:'product_group',num_items:1,value:item.price,currency:'USD'});
});
