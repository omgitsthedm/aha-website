import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFor, verifyOrderToken, orderStatusUrl } from '../server/orders/status.mjs';
import { checkoutReady } from '../server/checkout/runtime.mjs';
import { normalizeItems } from '../server/checkout/catalog.mjs';
import { createNotificationService } from '../server/notifications/service.mjs';

test('a supplier ID or a tracking label cannot hide a hold', () => {
  assert.equal(stageFor({state:'attention', apliiq_order_id:'supplier', tracking:[{trackingNumber:'label'}]}), 'review');
});
test('partial shipment remains partial', () => {
  assert.equal(stageFor({state:'shipped_partial', tracking:[{trackingNumber:'one-parcel'}]}), 'partial');
});
test('checkout recovery readiness survives the new-sale pause', () => {
  assert.equal(checkoutReady({enabled:false, accessToken:'test', applicationId:'test', locationId:'test'}, { recovery:true }), true);
});
test('server-owned quote freezes the purchased SKU and title', () => {
  const id='AAAAAAAAAAAAAAAAAAAA';
  const [item]=normalizeItems([{variationId:id, quantity:1, sku:'forged', title:'forged'}], {[id]:{priceCents:5200, sku:'approved-sku',title:'Approved garment',size:'M',product:'garment'}});
  assert.equal(item.sku,'approved-sku'); assert.equal(item.title,'Approved garment');
});
test('a disabled sender retains the receipt obligation', async () => {
  let saved;
  const service=createNotificationService({repository:{enqueue:async r=>(saved=r)},gateway:{},config:{enabled:false}});
  await service.enqueueConfirmation({recipient:'test@example.com',orderId:'local-order',orderNumber:'AHA-local',items:[],totalAmount:5200,currency:'USD'});
  assert.equal(saved?.dedupeKey,'local-order:order_confirmed');
});
test('order-link rotation can retain explicitly configured previous keys', () => {
  const old='local-test-old-key-long-enough'; const next='local-test-new-key-long-enough';
  const url=new URL(orderStatusUrl('local-order-123',{get:k=>k==='AHA_ORDER_LINK_SECRET'?old:null}));
  assert.equal(verifyOrderToken('local-order-123',url.searchParams.get('k'),{get:k=>({AHA_ORDER_LINK_SECRET:next,AHA_ORDER_LINK_PREVIOUS_SECRETS:JSON.stringify([old])})[k]}),true);
});

test('dedicated order-link key preserves existing links derived from the Square key',()=>{
 const legacy='legacy-local-square-key-for-fixtures';
 const link=new URL(orderStatusUrl('local-order-123',{get:k=>k==='AHA_SQUARE_WEBHOOK_SIGNATURE_KEY'?legacy:null}));
 assert.equal(verifyOrderToken('local-order-123',link.searchParams.get('k'),{get:k=>({AHA_ORDER_LINK_SECRET:'dedicated-local-key-for-fixtures',AHA_SQUARE_WEBHOOK_SIGNATURE_KEY:legacy})[k]}),true);
});


test('secret rotation preserves previously emailed unsubscribe links',async()=>{
 const {unsubscribeLinks,verifyUnsubscribe}=await import('../server/notifications/unsubscribe.mjs');
 const legacy='legacy-local-square-key-for-fixtures';const old={get:k=>k==='AHA_SQUARE_WEBHOOK_SIGNATURE_KEY'?legacy:null};
 const link=new URL(unsubscribeLinks(123,old).page);
 const rotated={get:k=>({AHA_ORDER_LINK_SECRET:'dedicated-local-key-for-fixtures',AHA_SQUARE_WEBHOOK_SIGNATURE_KEY:legacy})[k]};
 assert.equal(verifyUnsubscribe(123,link.searchParams.get('k'),rotated),true);
 assert.equal(verifyUnsubscribe(124,link.searchParams.get('k'),rotated),false);
});
