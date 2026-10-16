export {};
type Consent={analytics:boolean;marketing:boolean;at:number};
type Queue=((...args:unknown[])=>void)&{queue?:unknown[][];loaded?:boolean;version?:string;callMethod?:(...args:unknown[])=>void;push?:Queue};
type PostHog=unknown[]&{__SV?:number;_i?:unknown[][];init?:(key:string,config:Record<string,unknown>)=>void;capture?:(event:string,properties?:Record<string,unknown>)=>void;opt_out_capturing?:()=>void;get_distinct_id?:()=>string|undefined;get_session_id?:()=>string|undefined;[method:string]:unknown};
declare global {interface Window {dataLayer:unknown[];gtag:(...args:unknown[])=>void;fbq?:Queue;_fbq?:Queue;posthog?:PostHog;__ahaTrackingEvents?:{ga:unknown[][];meta:unknown[][];posthog?:unknown[][]};}}
const banner=document.querySelector<HTMLElement>('.cookie-banner');
const enabled=banner?.dataset.trackingEnabled==='true';
const key='aha-cookie-choices-v1';
const maxAge=180*24*60*60*1000;
const gpc=(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true;
let consent:Consent;
try{const raw=JSON.parse(localStorage.getItem(key)||'null');if(raw&&typeof raw.analytics==='boolean'&&typeof raw.marketing==='boolean'&&Date.now()-raw.at<maxAge)consent=raw;}catch{/* Storage is optional. */}
// A new visitor receives the storefront default without writing a synthetic consent click.
consent ??= {analytics:true,marketing:!gpc,at:Date.now()};
// Consent decides whether a vendor request can exist. Meta parsing stays off
// the page thread; GA uses its supported main-thread SDK after the same idle gate.
function insert(src:string,worker:boolean){const script=document.createElement('script');script.type=worker?'text/partytown':'text/javascript';script.async=true;script.src=src;document.head.append(script);}
let analyticsSdkScheduled=false;
let posthogSdkScheduled=false;
let posthogSdkLoaded=false;
let marketingSdkScheduled=false;
let analyticsSdkLoaded=false;
let marketingSdkLoaded=false;
type IdleWindow=Window&{requestIdleCallback?:(callback:()=>void,options?:{timeout?:number})=>number};
function scheduleSdk(kind:'analytics'|'marketing'|'posthog',src:string){
 const scheduled=kind==='analytics'?analyticsSdkScheduled:kind==='posthog'?posthogSdkScheduled:marketingSdkScheduled;
 const loaded=kind==='analytics'?analyticsSdkLoaded:kind==='posthog'?posthogSdkLoaded:marketingSdkLoaded;
 if(scheduled||loaded)return;
 if(kind==='analytics')analyticsSdkScheduled=true;else if(kind==='posthog')posthogSdkScheduled=true;else marketingSdkScheduled=true;
 const run=()=>{
  const idle=(window as IdleWindow).requestIdleCallback;
  const insertWhenIdle=()=>{
   if(kind==='analytics')analyticsSdkScheduled=false;else if(kind==='posthog')posthogSdkScheduled=false;else marketingSdkScheduled=false;
   // The immediate queue keeps the first page event. Recheck before loading optional vendor code.
   if(kind==='marketing'?(!consent.marketing||gpc):kind==='posthog'?(!consent.analytics||gpc):!consent.analytics)return;
   if(kind==='analytics')analyticsSdkLoaded=true;else if(kind==='posthog')posthogSdkLoaded=true;else marketingSdkLoaded=true;
   insert(src,kind==='marketing');
  };
  if(idle)idle.call(window,insertWhenIdle,{timeout:1000});else window.setTimeout(insertWhenIdle,0);
 };
 // Give the initial page a paint opportunity before optional vendor work.
 const afterPaint=()=>window.requestAnimationFrame(()=>window.requestAnimationFrame(run));
 if(document.readyState==='complete')afterPaint();else window.addEventListener('load',afterPaint,{once:true});
}
function cleanLocation(){const url=new URL(location.pathname,location.origin);const search=new URLSearchParams(location.search);for(const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=search.get(name);if(value&&value.length<150)url.searchParams.set(name,value);}return url.href;}
function product(){const node=document.querySelector<HTMLElement>('[data-product-id]');return node?{item_id:node.dataset.productId,item_name:node.dataset.productName,price:Number(node.dataset.productPrice),item_brand:'After Hours Agenda',item_variant:node.dataset.productColor,quantity:1}:null;}
function events(){return window.__ahaTrackingEvents??=( {ga:[],meta:[]} );}
function ga(...args:unknown[]){events().ga.push(args);window.gtag?.(...args);}
function meta(...args:unknown[]){events().meta.push(args);window.fbq?.(...args);}
// PostHog gets product ids, sizes, quantities and prices only — never customer details.
function ph(event:string,properties:Record<string,unknown>={}){const log=events();(log.posthog??=[]).push([event,properties]);window.posthog?.capture?.(event,properties);}
const posthogMethods=['capture','register','register_once','unregister','identify','reset','opt_in_capturing','opt_out_capturing','startSessionRecording','stopSessionRecording'];
function posthogStub():PostHog{
 // Same queue contract as PostHog's official loader: array.js replays _i and queued calls.
 const existing=window.posthog;
 if(existing&&existing.__SV)return existing;
 const stub=(existing??[]) as PostHog;
 stub._i=[];
 for(const method of posthogMethods)stub[method]=(...args:unknown[])=>{stub.push([method,...args]);};
 stub.init=(key:string,config:Record<string,unknown>)=>{stub._i?.push([key,config,'posthog']);};
 stub.__SV=1;
 window.posthog=stub;
 return stub;
}
function replaySampled(sample:number){
 // One decision per browser tab session, so a sampled visit records end to end.
 const storageKey='aha-ph-replay';
 try{const saved=sessionStorage.getItem(storageKey);if(saved==='1'||saved==='0')return saved==='1';const chosen=Math.random()<sample;sessionStorage.setItem(storageKey,chosen?'1':'0');return chosen;}catch{return false;}
}
function activate(value:Consent){
 if(!enabled)return;
 const item=product();
 if(value.analytics&&banner?.dataset.gaId){
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  ga('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  ga('consent','update',{analytics_storage:'granted'});
  ga('js',new Date());
  ga('config',banner.dataset.gaId,{page_location:cleanLocation(),page_referrer:document.referrer?new URL(document.referrer).origin:'',allow_google_signals:false,allow_ad_personalization_signals:false,send_page_view:true});
  if(item)ga('event','view_item',{currency:'USD',value:item.price,items:[item]});
  scheduleSdk('analytics',`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(banner.dataset.gaId)}`);
 }
 if(value.marketing&&!gpc&&banner?.dataset.metaId){
  const queue:Queue=window.fbq||(()=>{const stub:Queue=function(...args:unknown[]){if(stub.callMethod)stub.callMethod(...args);else stub.queue?.push(args);};return stub;})();
  if(!queue.queue)queue.queue=[];
  if(!window._fbq)window._fbq=queue;
  if(!window.fbq){queue.loaded=true;queue.version='2.0';queue.push=queue;window.fbq=queue;window._fbq=queue;}
  meta('consent','grant');meta('set','autoConfig',false,banner.dataset.metaId);meta('init',banner.dataset.metaId);meta('track','PageView');
  if(item)meta('track','ViewContent',{content_ids:[item.item_id],content_type:'product_group',content_name:item.item_name,value:item.price,currency:'USD'});
  scheduleSdk('marketing','https://connect.facebook.net/en_US/fbevents.js');
 }
 // PostHog: trends on every visit, replay for a sample. GPC and the analytics opt-out both keep it off.
 const posthogKey=banner?.dataset.posthogKey;
 if(value.analytics&&!gpc&&posthogKey){
  let host='https://us.i.posthog.com';
  try{const url=new URL(banner?.dataset.posthogHost||host);if(url.protocol==='https:'&&url.hostname.endsWith('.i.posthog.com'))host=url.origin;}catch{/* Keep the default host. */}
  const sample=Number(banner?.dataset.posthogReplay??'0.2');
  const record=replaySampled(Number.isFinite(sample)?sample:0.2);
  posthogStub().init?.(posthogKey,{
   api_host:host,person_profiles:'identified_only',
   capture_pageview:true,capture_pageleave:true,autocapture:true,rageclick:true,enable_heatmaps:true,
   disable_surveys:true,respect_dnt:true,
   disable_session_recording:!record,
   session_recording:{maskAllInputs:true,maskTextSelector:'[data-ph-mask], address'},
   before_send:(event:{properties?:Record<string,unknown>}|null)=>{if(event?.properties&&typeof event.properties.$current_url==='string')event.properties.$current_url=cleanLocation();return event;},
  });
  if(item)ph('product_viewed',{product_id:item.item_id,product_name:item.item_name,color:item.item_variant,price:item.price});
  scheduleSdk('posthog',`${host.replace('.i.posthog.com','-assets.i.posthog.com')}/static/array.js`);
 }
}
function clearPostHogStorage(){try{for(const name of Object.keys(localStorage))if(name.startsWith('ph_'))localStorage.removeItem(name);}catch{/* Storage is optional. */}}
function clearCookies(){for(const entry of document.cookie.split(';')){const name=entry.trim().split('=')[0] || '';if(!/^(_ga|_gid|_gat|_fbp|_fbc|ph_)/.test(name))continue;for(const domain of ['',`; domain=${location.hostname}`,'; domain=.afterhoursagenda.com'])document.cookie=`${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;}}
if(banner)banner.hidden=true;
activate(consent);
document.querySelectorAll<HTMLButtonElement>('[data-consent]').forEach(button=>button.addEventListener('click',()=>{
 const value={analytics:button.dataset.consent!=='essential',marketing:button.dataset.consent==='all'&&!gpc,at:Date.now()};
 const previous=consent;
 let persisted=true;
 try{localStorage.setItem(key,JSON.stringify(value));}catch{persisted=false;}
 if(banner)banner.hidden=true;
 if(persisted){
  window.fbq?.('consent','revoke');
  window.gtag?.('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  if(!value.analytics){window.posthog?.opt_out_capturing?.();clearPostHogStorage();}
  clearCookies();
  location.reload();
  return;
 }
 // Storage can be blocked. Honor the selection for this document without inventing a saved choice.
 consent=value;
 if(!value.marketing&&previous.marketing)window.fbq?.('consent','revoke');
 if(!value.analytics&&previous.analytics){window.gtag?.('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.posthog?.opt_out_capturing?.();clearPostHogStorage();clearCookies();}
 if(value.analytics&&!previous.analytics)activate({analytics:true,marketing:false,at:value.at});
 if(value.marketing&&!previous.marketing)activate({analytics:false,marketing:true,at:value.at});
}));
document.querySelectorAll<HTMLButtonElement>('[data-privacy-settings]').forEach(button=>button.addEventListener('click',()=>{if(banner){banner.hidden=false;banner.querySelector<HTMLButtonElement>('button')?.focus();}}));
document.addEventListener('aha:checkout-quoted',(event)=>{
 if(!enabled||!consent)return;
 const detail=(event as CustomEvent<{value:number;items:Array<{id:string;name:string;price:number;quantity:number}>}>).detail;
 if(!detail||!Number.isFinite(detail.value)||!Array.isArray(detail.items))return;
 const items=detail.items.map(item=>({item_id:item.id,item_name:item.name,item_brand:'After Hours Agenda',price:item.price,quantity:item.quantity}));
 if(consent.analytics)ga('event','begin_checkout',{currency:'USD',value:detail.value,items});
 if(consent.analytics&&!gpc)ph('checkout_started',{value:detail.value,currency:'USD',item_count:detail.items.reduce((total,item)=>total+item.quantity,0),product_ids:detail.items.map(item=>item.id)});
 if(consent.marketing&&!gpc)meta('track','InitiateCheckout',{content_ids:detail.items.map(item=>item.id),content_type:'product',num_items:detail.items.reduce((total,item)=>total+item.quantity,0),value:detail.value,currency:'USD'});
});

document.addEventListener('aha:purchase-confirmed',(event)=>{
 if(!enabled||!consent)return;
 const detail=(event as CustomEvent<{orderId:string;value:number;shipping:number;tax:number;currency:string;items:Array<{id:string;name:string;price:number;quantity:number}>}>).detail;
 if(!detail||typeof detail.orderId!=='string'||!Number.isFinite(detail.value)||!Number.isFinite(detail.shipping)||!Number.isFinite(detail.tax)||typeof detail.currency!=='string'||!Array.isArray(detail.items))return;
 const items=detail.items.map(item=>({item_id:item.id,item_name:item.name,item_brand:'After Hours Agenda',price:item.price,quantity:item.quantity}));
 if(consent.analytics)ga('event','purchase',{transaction_id:detail.orderId,currency:detail.currency,value:detail.value,shipping:detail.shipping,tax:detail.tax,items});
 if(consent.analytics&&!gpc)ph('purchase',{order_id:detail.orderId,value:detail.value,currency:detail.currency,item_count:detail.items.reduce((total,item)=>total+item.quantity,0),product_ids:detail.items.map(item=>item.id)});
 if(consent.marketing&&!gpc)meta('track','Purchase',{content_ids:detail.items.map(item=>item.id),content_type:'product',num_items:detail.items.reduce((total,item)=>total+item.quantity,0),value:detail.value,currency:detail.currency},{eventID:detail.orderId});
});

document.addEventListener('aha:cart-added',(event)=>{
 if(!enabled||!consent)return;
 const detail=(event as CustomEvent<{id:string;name:string;size:string;color:string;price:number;quantity:number}>).detail;
 if(!detail||typeof detail.id!=='string'||!Number.isFinite(detail.price)||!Number.isInteger(detail.quantity))return;
 const value=detail.price*detail.quantity;
 if(consent.analytics)ga('event','add_to_cart',{currency:'USD',value,items:[{item_id:detail.id,item_name:detail.name,item_brand:'After Hours Agenda',item_variant:detail.color,price:detail.price,quantity:detail.quantity}]});
 if(consent.analytics&&!gpc)ph('add_to_cart',{product_id:detail.id,product_name:detail.name,size:detail.size,color:detail.color,price:detail.price,quantity:detail.quantity});
 if(consent.marketing&&!gpc)meta('track','AddToCart',{content_ids:[detail.id],content_type:'product',value,currency:'USD'});
});
