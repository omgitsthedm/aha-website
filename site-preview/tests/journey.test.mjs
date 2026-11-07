import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {recordProgress,supplierMilestone,progressStillDue} from '../server/orders/lifecycle.mjs';
import {quantitiesDelivered,trackerObservation,applyTracker,runTracking} from '../server/orders/tracking.mjs';
import {handleOrderRequest} from '../server/orders/requests.mjs';
import {orderStatusUrl,stageFor} from '../server/orders/status.mjs';
import {createNetlifyRepository} from '../server/fulfillment/repository.mjs';
import {renderShipment,renderProgress} from '../server/notifications/templates.mjs';
import {reviewRequestCandidates,stillDue} from '../server/notifications/customer-emails.mjs';
import {createNotificationRepository} from '../server/notifications/repository.mjs';
import {createNotificationService} from '../server/notifications/service.mjs';
const env={get:key=>key==='AHA_ORDER_LINK_SECRET'?'local-test-only-secret-at-least-32':undefined};
const id='JOURNEY_ORDER_001';
async function fixture(t,state='submitted_reconciled') {
  const pg=new PGlite();t.after(()=>pg.close());
  const dir=new URL('../netlify/database/migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>n>='20261015').sort()) await pg.exec(await readFile(new URL(`${name}/migration.sql`,dir),'utf8'));
  const db={sql:async(strings,...values)=>(await pg.query(strings.reduce((s,p,i)=>s+(i?`$${i}`:'')+p,''),values)).rows};
  await db.sql`INSERT INTO aha_fulfillment_orders(square_order_id,state,customer_email,submitted_items,apliiq_payload)
    VALUES(${id},${state},'buyer@example.com','[{"sku":"SKU1","quantity":2,"title":"Hoodie","size":"XL"}]','{"order_number":"AHA-TEST"}')`;
  return {db,pg};
}
test('supplier milestone requires explicit production and never invents production from acceptance',()=>{
  const record={state:'submitted_reconciled'};
  assert.equal(supplierMilestone(record,{Status:'Preparing to Release'}),'accepted');
  assert.equal(supplierMilestone(record,{Status:'In Production'}),'creating');
  assert.equal(supplierMilestone(record,{Status:'Ready To Ship'}),'ready');
  assert.equal(supplierMilestone(record,{Status:'On Hold'}),'delayed');
  assert.equal(supplierMilestone(record,{Status:'garbled'}),null);
  assert.equal(supplierMilestone({...record,state:'shipped'},{Status:'In Production'}),null);
});
test('progress observation and email are atomic, deduplicated and never go backwards',async t=>{
  const {db}=await fixture(t);
  await recordProgress(db,env,id,'creating');await recordProgress(db,env,id,'creating');await recordProgress(db,env,id,'accepted');
  const mail=await db.sql`SELECT kind,payload_json FROM aha_order_notifications`;
  assert.equal(mail.length,1);assert.equal(mail[0].payload_json.stage,'creating');
  assert.equal((await db.sql`SELECT * FROM aha_order_milestones`).length,1);
});
test('refund suppresses new progress mail',async t=>{
  const {db}=await fixture(t);
  await db.sql`INSERT INTO aha_order_financials(square_order_id,square_payment_id,payment_state,refund_state) VALUES(${id},'P','COMPLETED','refunded')`;
  await recordProgress(db,env,id,'creating');assert.equal((await db.sql`SELECT * FROM aha_order_notifications`).length,0);
});
test('partial shipment email names included and remaining pieces and escapes markup',()=>{
  const rendered=renderShipment({orderNumber:'AHA-1',items:[{title:'<hoodie>',size:'XL',quantity:1}],remainingItems:[{title:'Beanie',quantity:1}],trackingNumber:'123'});
  assert.match(rendered.text,/In this parcel:\n1 × <hoodie> \/ XL/);assert.match(rendered.text,/Still being prepared:\n1 × Beanie/);
  assert.match(rendered.html,/&lt;hoodie&gt;/);assert.match(renderProgress({stage:'creating',orderNumber:'1'}).text,/confirmed/);
});
test('delivery requires all purchased quantities and actual delivered scans',()=>{
  assert.equal(quantitiesDelivered([{sku:'x',quantity:2}],[{status:'delivered',delivered_at:'2026-01-01',items:[{sku:'x',quantity:1}]}]),false);
  assert.equal(quantitiesDelivered([{sku:'x',quantity:1}],[{status:'delivered',delivered_at:'2026-01-01',items:[{sku:'wrong',quantity:10}]}]),false);
  const row={tracking_number:'TRACK',carrier:'UPS'};
  assert.throws(()=>trackerObservation({mode:'test',id:'trk_x',tracking_code:'TRACK'},row));
  assert.throws(()=>trackerObservation({mode:'production',id:'trk_x',tracking_code:'OTHER'},row));
  assert.equal(trackerObservation({mode:'production',id:'trk_x',tracking_code:'TRACK',carrier:'UPS',status:'delivered',updated_at:new Date().toISOString()},row).deliveredAt,null);
});
test('two parcels become delivered once, stale carrier status cannot reverse delivery',async t=>{
  const {db}=await fixture(t,'shipped');
  for(const number of ['T1','T2']) await db.sql`INSERT INTO aha_shipment_tracking(square_order_id,tracking_number,carrier,items) VALUES(${id},${number},'UPS','[{"sku":"SKU1","quantity":1}]')`;
  const event=number=>({id:`trk_${number}`,tracking_code:number,carrier:'UPS',mode:'production',status:'delivered',updated_at:new Date().toISOString(),tracking_details:[{status:'delivered',datetime:new Date(Date.now()-60000).toISOString()}]});
  const row=number=>({square_order_id:id,tracking_number:number,carrier:'UPS'});
  await applyTracker(db,env,row('T1'),event('T1'));assert.equal((await db.sql`SELECT delivered_at FROM aha_fulfillment_orders`)[0].delivered_at,null);
  await applyTracker(db,env,row('T2'),event('T2'));await applyTracker(db,env,row('T2'),event('T2'));
  assert.ok((await db.sql`SELECT delivered_at FROM aha_fulfillment_orders`)[0].delivered_at);
  assert.equal((await db.sql`SELECT * FROM aha_order_notifications WHERE kind='order_progress'`).length,1);
  await applyTracker(db,env,row('T2'),{...event('T2'),status:'in_transit',updated_at:new Date(Date.now()-120000).toISOString()});
  assert.equal((await db.sql`SELECT status FROM aha_shipment_tracking WHERE tracking_number='T2'`)[0].status,'delivered');
});
test('tracking cannot call a paid service without enabled credentials',async t=>{
  const {db}=await fixture(t);
  const result=await runTracking({db,env,fetchImpl:()=>{throw new Error('must not call provider');}});
  assert.equal(result.configured,false);
});
test('private customer cancellation persists once and prevents supplier submission',async t=>{
  const {db}=await fixture(t,'queued');
  await db.sql`INSERT INTO aha_checkout_sessions(checkout_id,token_sha256,state,cart_json,shipping_address_json,order_payload_json,subtotal_cents,shipping_cents,tax_cents,total_cents,order_idempotency_key,expires_at,square_order_id)
    VALUES('checkout-test','x','completed','[]','{"email":"buyer@example.com"}','{}',100,0,0,100,'journey-key',now(),${id})`;
  const signed=new URL(orderStatusUrl(id,env));const body={o:id,k:signed.searchParams.get('k'),type:'cancel',requestId:'11111111-1111-4111-8111-111111111111',message:'Please cancel this order before production.'};
  const request=(payload=body)=>new Request('https://afterhoursagenda.com/api/orders/request',{method:'POST',headers:{origin:'https://afterhoursagenda.com','content-type':'application/json','x-aha-order':'1'},body:JSON.stringify(payload)});
  assert.equal((await handleOrderRequest(request({...body,k:'wrong'}),{db,env})).status,404);
  assert.equal((await handleOrderRequest(request(),{db,env})).status,202);
  assert.equal((await handleOrderRequest(request(),{db,env})).status,202);
  assert.equal((await db.sql`SELECT * FROM aha_support_cases`).length,1);
  assert.equal(await createNetlifyRepository(db).claimForSubmission(id),null);
});
test('reviews preserve the free tracking schedule and wait for delivery when tracking is active',async t=>{
  const {db}=await fixture(t,'shipped');
  await db.sql`UPDATE aha_email_programs SET started_at=now()-interval '60 days'`;
  await db.sql`INSERT INTO aha_order_notifications(dedupe_key,kind,recipient,payload_json,state,provider_message_id,sent_at) VALUES(${id+':order_shipped:T'},'order_shipped','buyer@example.com','{}','sent','mail-test',now()-interval '30 days')`;
  assert.equal((await reviewRequestCandidates(db)).length,1);
  assert.equal((await reviewRequestCandidates(db,20,true)).length,1); // Legacy parcel without item evidence.
  await db.sql`INSERT INTO aha_shipment_tracking(square_order_id,tracking_number,carrier,items) VALUES(${id},'T','UPS','[{"sku":"SKU1","quantity":2}]')`;
  assert.equal((await reviewRequestCandidates(db,20,true)).length,0);
  assert.equal(await stillDue(db,{kind:'review_request',dedupe_key:id+':review_request'},true),false);
  await db.sql`UPDATE aha_fulfillment_orders SET delivered_at=now()-interval '2 days' WHERE square_order_id=${id}`;
  assert.equal((await reviewRequestCandidates(db,20,true)).length,0);
  await db.sql`UPDATE aha_fulfillment_orders SET delivered_at=now()-interval '11 days' WHERE square_order_id=${id}`;
  assert.equal((await reviewRequestCandidates(db,20,true)).length,1);
  assert.equal(await stillDue(db,{kind:'review_request',dedupe_key:id+':review_request'},true),true);
  assert.equal(stageFor({state:'shipped',delivered_at:new Date()}),'delivered');
});

test('carrier registration budget remains a hard ceiling and transport errors retain retryable work',async t=>{
  const {db}=await fixture(t,'shipped');
  for(const number of ['B1','B2']) await db.sql`INSERT INTO aha_shipment_tracking(square_order_id,tracking_number,carrier,items) VALUES(${id},${number},'UPS','[{"sku":"SKU1","quantity":1}]')`;
  let calls=0;
  const configured={get:key=>({AHA_TRACKING_ENABLED:'true',AHA_EASYPOST_API_KEY:'test-only',AHA_TRACKING_MONTHLY_LIMIT:'1'})[key]};
  await runTracking({db,env:configured,fetchImpl:async()=>{calls++;return new Response('{}',{status:503});}});
  assert.equal(calls,1);
  assert.equal((await db.sql`SELECT registrations FROM aha_tracking_budgets`)[0].registrations,1);
  const rows=await db.sql`SELECT last_error_code FROM aha_shipment_tracking ORDER BY tracking_number`;
  assert.equal(rows[0].last_error_code,'tracking_http_503');assert.equal(rows[1].last_error_code,'tracking_registration_review');
});

test('stored delivery recovers after Square completion and after progress enqueue fails',async t=>{
  const {db}=await fixture(t,'ready_to_ship');
  await db.sql`INSERT INTO aha_shipment_tracking(square_order_id,tracking_number,carrier,items) VALUES(${id},'RECOVER','UPS','[{"sku":"SKU1","quantity":2}]')`;
  const row={square_order_id:id,tracking_number:'RECOVER',carrier:'UPS'};
  const tracker={id:'trk_recover',tracking_code:'RECOVER',carrier:'UPS',mode:'production',status:'delivered',updated_at:new Date().toISOString(),tracking_details:[{status:'delivered',datetime:new Date(Date.now()-60000).toISOString()}]};
  await applyTracker(db,env,row,tracker);
  assert.equal((await db.sql`SELECT delivered_at FROM aha_fulfillment_orders`)[0].delivered_at,null);
  await db.sql`UPDATE aha_fulfillment_orders SET state='shipped' WHERE square_order_id=${id}`;
  const interrupted={sql:async(parts,...values)=>{
    if(parts.join('').includes('WITH candidate AS')) throw new Error('simulated enqueue interruption');
    return db.sql(parts,...values);
  }};
  await assert.rejects(runTracking({db:interrupted,env}),/simulated enqueue interruption/);
  assert.ok((await db.sql`SELECT delivered_at FROM aha_fulfillment_orders`)[0].delivered_at);
  assert.equal((await db.sql`SELECT * FROM aha_order_notifications`).length,0);
  await runTracking({db,env,fetchImpl:()=>{throw new Error('no paid call needed');}});
  await runTracking({db,env});
  assert.equal((await db.sql`SELECT * FROM aha_order_notifications WHERE kind='order_progress'`).length,1);
});

test('queued progress is skipped after financial changes and newer stages',async t=>{
  const {db}=await fixture(t);
  let sends=0;
  const service=createNotificationService({repository:createNotificationRepository(db),gateway:{send:async()=>{sends++;return{id:'mail'};}},
    config:{enabled:true,apiKey:'test',from:'test',replyTo:'test'},progressDue:row=>progressStillDue(db,row)});
  await db.sql`INSERT INTO aha_order_financials(square_order_id,square_payment_id,payment_state) VALUES(${id},'P','COMPLETED')`;
  for(const field of ['refund_state','cancellation_state','dispute_state']) {
    await recordProgress(db,env,id,'creating');
    if(field==='refund_state') await db.sql`UPDATE aha_order_financials SET refund_state='refunded'`;
    if(field==='cancellation_state') await db.sql`UPDATE aha_order_financials SET cancellation_state='requested'`;
    if(field==='dispute_state') await db.sql`UPDATE aha_order_financials SET dispute_state='open'`;
    const result=await service.dispatch();assert.equal(result.sent,0);
    assert.equal((await db.sql`SELECT last_error_code FROM aha_order_notifications`)[0].last_error_code,'progress_no_longer_due');
    await db.sql`DELETE FROM aha_order_notifications`;await db.sql`DELETE FROM aha_order_milestones`;
    await db.sql`UPDATE aha_order_financials SET refund_state='none',cancellation_state='none',dispute_state='none'`;
  }
  await recordProgress(db,env,id,'creating');await recordProgress(db,env,id,'ready');
  await service.dispatch();assert.equal(sends,1);
});
