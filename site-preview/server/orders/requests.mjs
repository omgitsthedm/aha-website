import { verifyOrderToken } from './status.mjs';
import { boundedText } from '../http/body.mjs';
import { saveSupportCase } from '../support/cases.mjs';
import { SITE_ORIGIN } from '../platform/client.mjs';
import { createHash } from 'node:crypto';

const TYPES = { address: 'Shipping address correction', cancel: 'Cancellation request', exchange: 'Exchange request', refund: 'Refund request', missing: 'Missing or damaged parcel', email: 'Receipt email correction', help: 'Order question' };
const headers = { 'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-robots-tag':'noindex' };
const reply=(body,status=200)=>Response.json(body,{status,headers});
export async function handleOrderRequest(request,{db,env,origin=SITE_ORIGIN}) {
  if(request.method!=='POST') return reply({error:'Not found.'},404);
  if(request.headers.get('origin')!==origin || request.headers.get('x-aha-order')!=='1') return reply({error:'Request blocked.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'Request must be JSON.'},415);
  let input;try {input=JSON.parse(await boundedText(request,8192));}catch{return reply({error:'Check your request and try again.'},400);}
  if(!input || !verifyOrderToken(input.o,input.k,env)) return reply({error:'Use the private link in your order email.'},404);
  if(!Object.hasOwn(TYPES,input.type) || !/^[a-f0-9-]{36}$/i.test(input.requestId ?? '') || typeof input.message!=='string' || input.message.trim().length<10 || input.message.length>1800)
    return reply({error:'Choose a request and include a short explanation.'},422);
  const [order]=await db.sql`SELECT COALESCE(c.notification_email,f.customer_email,c.shipping_address_json->>'email') AS email,
    f.state,f.apliiq_order_id,f.delivered_at FROM aha_checkout_sessions c LEFT JOIN aha_fulfillment_orders f USING(square_order_id)
    WHERE c.square_order_id=${input.o} AND c.state='completed' LIMIT 1`;
  if(!order?.email) return reply({error:'We could not find that paid order.'},404);
  if(['exchange','refund'].includes(input.type) && order.delivered_at && Date.now()-new Date(order.delivered_at).getTime()>30*86400000)
    return reply({error:'The 30-day request window has passed. Choose Order question to discuss your circumstances with us.'},422);
  const key=createHash('sha256').update(`order-request:${input.o}`).digest('hex');
  const window=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
  const [quota]=await db.sql`INSERT INTO aha_commerce_rate_limits(key_hash,window_start) VALUES(${key},${window})
    ON CONFLICT(key_hash,window_start) DO UPDATE SET attempts=aha_commerce_rate_limits.attempts+1 RETURNING attempts`;
  if(Number(quota.attempts)>5) return reply({error:'Please wait before sending another request. You can also reply to your order email.'},429);
  const caseId=await saveSupportCase(db,{id:input.requestId,topic:TYPES[input.type],email:order.email,
    text:`${TYPES[input.type]}\nOrder: ${input.o}\n\n${input.message.trim()}`,reference:input.o,requestType:input.type});
  return reply({ok:true,caseId,message:'Your request is saved for review. This does not confirm a cancellation, address change, refund or replacement. We will reply using your order email.'},202);
}
