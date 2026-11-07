import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createCheckoutRepository} from '../server/checkout/repository.mjs';
import {createNotificationRepository} from '../server/notifications/repository.mjs';
import {createNotificationService} from '../server/notifications/service.mjs';
import {createNetlifyRepository} from '../server/fulfillment/repository.mjs';
import {saveSupportCase} from '../server/support/cases.mjs';
import {refreshFinancials,runSquareRecovery} from '../server/operations/recovery.mjs';
import {orderAction} from '../server/admin/order-actions.mjs';
import {commerceHealth} from '../server/operations/commerce.mjs';
import {permitPaymentAttempt} from '../server/checkout/abuse.mjs';
const migrations=['20261015045000_yikes_fulfillment','20261015160000_custom_checkout','20261015170000_order_notifications','20261015180000_checkout_payment_recovery','20261016100000_checkout_analytics_link','20261016120000_admin','20261016130000_owner_reports','20261018120000_marketing_purchase_outbox','20261019120000_customer_emails','20261107020000_commerce_safeguards','20261107090000_commerce_reliability','20261107120000_customer_journey'];
async function isolated(t) {
 const database=new PGlite();t.after(()=>database.close());
 for(const name of migrations) {
  const sql=await readFile(new URL(`../netlify/database/migrations/${name}/migration.sql`,import.meta.url),'utf8');
  if(name.endsWith('commerce_reliability')) assert.equal(sql,await readFile(new URL(`../../netlify/database/migrations/${name}/migration.sql`,import.meta.url),'utf8'));
  await database.exec(sql);
 }
 const db={sql:async(strings,...parameters)=>(await database.query(strings.reduce((s,p,i)=>s+(i?`$${i}`:'')+p,''),parameters)).rows};
 db.pool={connect:async()=>({query:async(text,params)=>{const result=await database.query(text,params);return {...result,rowCount:result.affectedRows ?? result.rows.length};},release(){}})};
 return {db,database,checkout:createCheckoutRepository(db),mail:createNotificationRepository(db),fulfillment:createNetlifyRepository(db)};
}
const quote={checkoutId:'local-checkout-1',tokenHash:'local-hash',currency:'USD',cart:[{variationId:'local-variation',quantity:1,sku:'approved-sku',title:'Purchased garment',priceCents:5000}],address:{email:'fixture@example.com'},orderPayload:{reference_id:'AHA-local-checkout-1'},subtotalCents:5000,shippingCents:0,taxCents:0,totalCents:5000,orderIdempotencyKey:'local-order-key',expiresAt:'2030-01-01T00:00:00Z'};
async function paid(checkout) {await checkout.create(quote);return checkout.complete({checkoutId:quote.checkoutId,orderId:'local-order-123',paymentId:'local-payment-123'});}
test('paid checkout and recovery obligation commit together and dedupe',async t=>{
 const {db,database,checkout}=await isolated(t);await paid(checkout);
 await checkout.complete({checkoutId:quote.checkoutId,orderId:'local-order-123',paymentId:'local-payment-123'});
 assert.equal((await db.sql`SELECT * FROM aha_fulfillment_square_events`).length,1);
 assert.equal(await checkout.complete({checkoutId:quote.checkoutId,orderId:'different-order',paymentId:'different-payment'}),null);
 await checkout.create({...quote,checkoutId:'rollback-checkout',orderIdempotencyKey:'rollback-key'});
 await database.exec("CREATE FUNCTION fail_obligation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture interruption'; END $$; CREATE TRIGGER fail_obligation BEFORE INSERT ON aha_fulfillment_square_events FOR EACH ROW EXECUTE FUNCTION fail_obligation();");
 await assert.rejects(()=>checkout.complete({checkoutId:'rollback-checkout',orderIdempotencyKey:'rollback-key',orderId:'rollback-order',paymentId:'rollback-payment'}));
 assert.equal((await checkout.get('rollback-checkout')).state,'quoted');
});
test('transactional receipt beats a burst of 200 older marketing jobs; stale worker is fenced',async t=>{
 const {db,mail}=await isolated(t);
 for(let i=0;i<200;i++) await mail.enqueue({dedupeKey:`cart-${i}`,kind:'cart_reminder',recipient:'fixture@example.com',payload:{}});
 await mail.enqueue({dedupeKey:'paid:receipt',kind:'order_confirmed',recipient:'fixture@example.com',payload:{}});
 const [first]=await mail.claim(1);assert.equal(first.dedupe_key,'paid:receipt');
 await db.sql`UPDATE aha_order_notifications SET attempt_count=attempt_count+1 WHERE id=${first.id}`;
 assert.equal(await mail.markSent({id:first.id,attemptCount:first.attempt_count,providerMessageId:'stale'}),null);
});
test('support message and alert survive mail provider outage with exact request dedupe',async t=>{
 const {db,mail}=await isolated(t);
 const value={id:'10000000-0000-4000-8000-000000000001',topic:'Exchange or refund',email:'fixture@example.com',text:'Please help with this order <script>unsafe</script>',reference:'AHA-local'};
 await saveSupportCase(db,value);await saveSupportCase(db,value);
 await assert.rejects(()=>saveSupportCase(db,{...value,text:'conflicting message'}));
 let sent;
 const service=createNotificationService({repository:mail,gateway:{send:async message=>{sent=message;throw new Error('mail offline');}},config:{enabled:true,apiKey:'test',from:'test@example.com',replyTo:'test@example.com'}});
 await service.dispatch(1);
 assert.equal((await db.sql`SELECT * FROM aha_support_cases`).length,1);
 assert.equal((await db.sql`SELECT * FROM aha_order_notifications`)[0].state,'pending');
 assert.ok(!sent.html.includes('<script>'));assert.equal(sent.replyTo,value.email);
});
test('parcel updates dedupe tracking and transient revalidation backs off',async t=>{
 const {db,fulfillment}=await isolated(t);
 await db.sql`INSERT INTO aha_fulfillment_orders(square_order_id,state) VALUES('local-order-123','queued')`;
 await fulfillment.deferRevalidation('local-order-123');assert.equal((await fulfillment.listQueued()).length,0);
 for(let i=0;i<3;i++)await fulfillment.recordShipment({squareOrderId:'local-order-123',quantities:{sku:1},tracking:{trackingNumber:'parcel-1'},complete:false});
 assert.equal((await fulfillment.getOrder('local-order-123')).tracking.length,1);
});
test('partial refund and fee reconciliation preserves paid order and stops production',async t=>{
 const {db,checkout}=await isolated(t);await paid(checkout);
 await db.sql`INSERT INTO aha_fulfillment_orders(square_order_id,square_payment_id,state) VALUES('local-order-123','local-payment-123','queued')`;
 const square={getPayment:async()=>({id:'local-payment-123',order_id:'local-order-123',status:'COMPLETED',amount_money:{amount:5000},refunded_money:{amount:1000},refund_ids:['refund-1'],processing_fee:[{amount_money:{amount:175}}]}),getRefund:async()=>({payment_id:'local-payment-123',status:'COMPLETED',amount_money:{amount:1000}}),getOrder:async()=>({id:'local-order-123',state:'OPEN'})};
 await refreshFinancials(db,square,'local-payment-123');
 const [money]=await db.sql`SELECT * FROM aha_order_financials`;assert.equal(money.refund_state,'partial');assert.equal(Number(money.processing_fee_cents),175);
 assert.equal((await checkout.get(quote.checkoutId)).state,'completed');
 assert.equal((await db.sql`SELECT * FROM aha_fulfillment_orders`)[0].state,'held');
});
test('missed callback sweep retains its page cursor and does not advance on provider outage',async t=>{
 const {db}=await isolated(t);let query;
 const square={listDisputes:async()=>({disputes:[]}),listPayments:async q=>{query=q;return {payments:[],cursor:'next-page'};}};
 const env={get:k=>k==='AHA_SQUARE_LOCATION_ID'?'location':null};
 await runSquareRecovery({db,env,square});assert.equal(query.limit,50);
 const [saved]=await db.sql`SELECT value_json FROM aha_commerce_cursors WHERE name='square-payments'`;assert.equal(saved.value_json.cursor,'next-page');
 await assert.rejects(()=>runSquareRecovery({db,env,square:{listPayments:async()=>{throw new Error('offline');}}}));
 const [after]=await db.sql`SELECT * FROM aha_commerce_cursors WHERE name='square-payments'`;assert.deepEqual(after.value_json,saved.value_json);assert.equal(after.lease_expires_at,null);
});
test('payment burst limit is atomic and does not affect another buyer',async t=>{
 const {db}=await isolated(t);const results=await Promise.all(Array.from({length:25},()=>permitPaymentAttempt(db,'fixture-ip',0)));
 assert.equal(results.filter(Boolean).length,20);assert.equal(await permitPaymentAttempt(db,'other-ip',0),true);
});

const ownerEnv={get:key=>key==='AHA_ORDER_LINK_SECRET'?'fixture-order-secret-long-enough':null};
const request=(n,email='verified@example.com')=>({requestId:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,reason:'Customer verified destination',customerVerified:true,email});
test('owner receipt correction is atomic, deduplicated and limited per order',async t=>{
 const {db,checkout,mail}=await isolated(t);await paid(checkout);
 await db.sql`INSERT INTO aha_admin_users(id,email) VALUES('fixture-owner','owner@example.com')`;
 const run=input=>orderAction({db,env:ownerEnv,user:{id:'fixture-owner'},orderId:'local-order-123',action:'receipt',input});
 await assert.rejects(()=>run({...request(1),customerVerified:false}),e=>e.status===422);
 await run(request(1));await run(request(1));
 assert.equal((await db.sql`SELECT * FROM aha_order_notifications`).length,1);
 assert.equal((await checkout.get(quote.checkoutId)).notification_email,'verified@example.com');
 await run(request(2));await run(request(3));await assert.rejects(()=>run(request(4)),e=>e.status===429);
 assert.equal((await db.sql`SELECT * FROM aha_admin_audit`).length,3);
 assert.equal(await mail.enqueue({dedupeKey:"local-order-123:order_confirmed",kind:"order_confirmed",recipient:"old@example.com",payload:{}}),null);
});
test('receipt audit failure rolls back both destination correction and mail enqueue',async t=>{
 const {db,database,checkout}=await isolated(t);await paid(checkout);
 await database.exec("CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON aha_admin_audit FOR EACH ROW EXECUTE FUNCTION fail_audit();");
 await assert.rejects(()=>orderAction({db,env:ownerEnv,user:{id:'fixture-owner'},orderId:'local-order-123',action:'receipt',input:request(1)}));
 assert.equal((await checkout.get(quote.checkoutId)).notification_email,null);
 assert.equal((await db.sql`SELECT * FROM aha_order_notifications`).length,0);
});
test('an uncertain supplier submission cannot be released by the owner action',async t=>{
 const {db,checkout}=await isolated(t);await paid(checkout);
 await db.sql`INSERT INTO aha_fulfillment_orders(square_order_id,square_payment_id,state,attempt_count) VALUES('local-order-123','local-payment-123','uncertain',1)`;
 await assert.rejects(()=>orderAction({db,env:ownerEnv,user:{id:'fixture-owner'},orderId:'local-order-123',action:'release',input:request(1)}),e=>e.status===409);
});
test('a delivered corrected receipt resolves an older bounce without deleting its history',async t=>{
 const {db,checkout,mail}=await isolated(t);await paid(checkout);
 await mail.enqueue({dedupeKey:'local-order-123:order_confirmed',kind:'order_confirmed',recipient:'old@example.com',payload:{}});
 const [first]=await mail.claim(1);await mail.markSent({id:first.id,attemptCount:first.attempt_count,providerMessageId:'old-message'});
 await db.sql`INSERT INTO aha_email_delivery_events(event_id,provider_message_id,event_type,occurred_at) VALUES('bounce','old-message','bounced',now())`;
 assert.ok((await commerceHealth({db,env:ownerEnv,checkMonitor:false})).problems.some(x=>x.code==='receipt_delivery_failed'));
 await mail.enqueue({dedupeKey:'local-order-123:receipt_resend:fixture',kind:'order_confirmed',recipient:'verified@example.com',payload:{}});
 const [next]=await mail.claim(1);await mail.markSent({id:next.id,attemptCount:next.attempt_count,providerMessageId:'new-message'});
 await db.sql`INSERT INTO aha_email_delivery_events(event_id,provider_message_id,event_type,occurred_at) VALUES('delivered','new-message','delivered',now())`;
 assert.ok(!(await commerceHealth({db,env:ownerEnv,checkMonitor:false})).problems.some(x=>x.code.startsWith('receipt_')));
 assert.equal((await db.sql`SELECT * FROM aha_email_delivery_events`).length,2);
});

test('a resolved dispute cannot hide another open dispute; missed resolution is swept',async t=>{
 const {db,checkout}=await isolated(t);await paid(checkout);
 await db.sql`UPDATE aha_checkout_sessions SET payment_submission_started_at=now() WHERE checkout_id=${quote.checkoutId}`;
 let resolved=false;
 const disputes=()=>[{id:'d1',state:'WON',version:1,disputed_payment:{payment_id:'local-payment-123'}},{id:'d2',state:resolved?'LOST':'EVIDENCE_REQUIRED',version:resolved?2:1,due_at:'2030-01-01T00:00:00Z',disputed_payment:{payment_id:'local-payment-123'}}];
 const square={listPayments:async()=>({payments:[]}),listDisputes:async()=>({disputes:disputes()}),getDispute:async id=>disputes().find(x=>x.id===id),getPayment:async()=>({id:'local-payment-123',order_id:'local-order-123',status:'COMPLETED',amount_money:{amount:5000}}),getOrder:async()=>({id:'local-order-123',state:'OPEN'})};
 const env={get:k=>k==='AHA_SQUARE_LOCATION_ID'?'location':null};
 await runSquareRecovery({db,env,square});assert.equal((await db.sql`SELECT dispute_state FROM aha_order_financials`)[0].dispute_state,'open');
 resolved=true;await runSquareRecovery({db,env,square});assert.equal((await db.sql`SELECT dispute_state FROM aha_order_financials`)[0].dispute_state,'lost');
});
test('pending or failed refunds and cancellations cannot continue normal production',async t=>{
 const {db,checkout}=await isolated(t);await paid(checkout);
 await db.sql`INSERT INTO aha_fulfillment_orders(square_order_id,square_payment_id,state) VALUES('local-order-123','local-payment-123','queued')`;
 let status='PENDING';let cancelled=false;
 const square={getPayment:async()=>({id:'local-payment-123',order_id:'local-order-123',status:'COMPLETED',amount_money:{amount:5000},refund_ids:['r1']}),getRefund:async()=>({payment_id:'local-payment-123',status,amount_money:{amount:1000}}),getOrder:async()=>({id:'local-order-123',state:cancelled?'CANCELED':'OPEN'})};
 await refreshFinancials(db,square,'local-payment-123');assert.equal((await db.sql`SELECT * FROM aha_order_financials`)[0].refund_state,'pending');
 status='FAILED';await refreshFinancials(db,square,'local-payment-123');assert.equal((await db.sql`SELECT * FROM aha_order_financials`)[0].refund_failed,true);
 cancelled=true;await refreshFinancials(db,square,'local-payment-123');assert.equal((await db.sql`SELECT * FROM aha_order_financials`)[0].cancellation_state,'cancelled');
 assert.equal((await db.sql`SELECT state FROM aha_fulfillment_orders`)[0].state,'held');
});
