import { createSquareGateway } from "../fulfillment/square.mjs";
import { validatePaidSquareOrder, FulfillmentHold } from "../fulfillment/service.mjs";
import { createRuntime, environmentConfig } from "../fulfillment/runtime.mjs";
import { currentCatalog } from "../catalog/current.mjs";
import { createHash } from 'node:crypto';
import { AdminAuthError } from './auth.mjs';
import { createNotificationRuntime } from '../notifications/runtime.mjs';
import { createNetlifyRepository } from '../fulfillment/repository.mjs';
import { orderStatusUrl } from '../orders/status.mjs';
import { normalizeEmail } from '../updates/signups.mjs';
const json=value=>typeof value==='string'?JSON.parse(value):value;
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function orderAction({db,env,user,orderId,action,input}) {
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(orderId) || !/^[a-f0-9-]{36}$/i.test(input.requestId ?? '')) throw new AdminAuthError('Invalid order action.',422);
  const reason=typeof input.reason==='string'?input.reason.trim():'';
  if(reason.length<5 || reason.length>500) throw new AdminAuthError('Record a short reason for this action.',422);
  const [session]=await db.sql`SELECT * FROM aha_checkout_sessions WHERE square_order_id=${orderId} AND state='completed' LIMIT 1`;
  const repo=createNetlifyRepository(db); const fulfillment=await repo.getOrder(orderId);
  const paymentId=session?.square_payment_id || fulfillment?.square_payment_id;
  if(!paymentId) throw new AdminAuthError('No verified payment for this order.',409);
  if(action==='release') {
    if(!fulfillment || !['held','attention'].includes(fulfillment.state) || fulfillment.apliiq_order_id || fulfillment.attempt_count !== 0 || !fulfillment.submitted_items?.length)
      throw new AdminAuthError('This order cannot be automatically released. Confirm any existing supplier order in Apliiq; uncertain submissions are never repeated.',409);
    const config=environmentConfig(env); const square=createSquareGateway({accessToken:env.get('AHA_SQUARE_ACCESS_TOKEN')});
    const payment=await square.getPayment(paymentId); const order=await square.getOrder(orderId);
    const [financial]=await db.sql`SELECT * FROM aha_order_financials WHERE square_order_id=${orderId}`;
    if(financial?.dispute_state==='open' || financial?.refund_pending_cents>0) throw new AdminAuthError('Resolve the active refund or dispute in Square first.',409);
    let validated;
    try { validated=validatePaidSquareOrder({payment,order,locationId:config.locationId,startAt:config.startAt,
      catalog:(await currentCatalog()).allowList,purchasedItems:fulfillment.submitted_items}); } catch(error) {
      if(error instanceof FulfillmentHold) throw new AdminAuthError(`Order remains held: ${error.code}.`,409); throw error;
    }
    if(hash(JSON.stringify(validated.apliiqPayload)) !== fulfillment.payload_sha256) throw new AdminAuthError('Purchased order details have changed. Resolve the mismatch before release.',409);
    const [released]=await db.sql`WITH changed AS (UPDATE aha_fulfillment_orders SET state='queued',next_attempt_at=now(),last_error_code=NULL,updated_at=now()
      WHERE square_order_id=${orderId} AND state IN ('held','attention') AND apliiq_order_id IS NULL AND attempt_count=0
      AND payload_sha256=${fulfillment.payload_sha256} RETURNING square_order_id),
      audit AS (INSERT INTO aha_admin_audit(user_id,action,target,detail_json)
      SELECT ${user.id},'order.hold_released',square_order_id,${JSON.stringify({reason,requestId:input.requestId})}::jsonb FROM changed)
      SELECT square_order_id FROM changed`;
    if(!released) throw new AdminAuthError('Order changed during review. Refresh it before trying again.',409);
    return {message:'Verified hold released. The worker will recheck payment before production.'};
  }
  if(action==='reconcile') {
    // Only queue authenticated re-reading. This cannot release a hold or POST
    // an uncertain submission. The fulfillment state machine keeps that guard.
    await repo.ingestSquareEvent({eventId:`admin:${input.requestId}`,paymentId});
    if(fulfillment?.apliiq_order_id) await createRuntime({database:db,env,catalog:(await currentCatalog()).allowList}).service.receiveApliiqFulfillment({providerOrderId:fulfillment.apliiq_order_id});
    await db.sql`INSERT INTO aha_admin_audit(user_id,action,target,detail_json) VALUES(${user.id},'order.reconcile',${orderId},${JSON.stringify({reason,requestId:input.requestId})})`;
    return {message:'Reconciliation queued. No payment or supplier order was repeated.'};
  }
  if(action!=='receipt') throw new AdminAuthError('Unknown order action.',404);
  const recipient=normalizeEmail(input.email || session?.notification_email || json(session?.shipping_address_json)?.email || fulfillment?.customer_email);
  if(!recipient || input.customerVerified !== true) throw new AdminAuthError('Verify the recipient with the customer before sending.',422);
  const [prior]=await db.sql`SELECT id FROM aha_order_notifications WHERE dedupe_key=${`${orderId}:receipt_resend:${input.requestId}`}`;
  if(prior) return {message:'This receipt request is already saved.'};
  const cart=json(session?.cart_json) || fulfillment?.submitted_items || [];
  const original=await db.sql`SELECT payload_json FROM aha_order_notifications WHERE dedupe_key=${`${orderId}:order_confirmed`} LIMIT 1`;
  const payload={...json(original[0]?.payload_json),orderNumber:json(session?.order_payload_json)?.reference_id || fulfillment?.apliiq_payload?.order_number || orderId,
    totalAmount:session?.total_cents ?? json(original[0]?.payload_json)?.totalAmount,currency:session?.currency || 'USD',
    items:cart.map(item=>({title:item.title || item.product || 'Your piece',size:item.size,quantity:item.quantity})),statusUrl:orderStatusUrl(orderId,env)};
  if(!payload.statusUrl || !Number.isSafeInteger(payload.totalAmount)) throw new AdminAuthError('Receipt details are incomplete. Reconcile this order first.',409);
  // Single database statement commits contact correction, outbox and audit.
  // Advisory lock serializes owner resends so a double click cannot bypass quota.
  const client=await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`receipt:${orderId}`]);
    const {rows:active}=await client.query("SELECT id,state FROM aha_order_notifications WHERE kind='order_confirmed' AND split_part(dedupe_key,':',1)=$1 AND state IN ('pending','sending','attention') FOR UPDATE",[orderId]);
    if(active.some(row=>row.state==='sending')) throw new AdminAuthError('A receipt attempt is still unresolved. Check delivery before requesting another.',409);
    const {rows:[count]}=await client.query("SELECT count(*)::int AS n FROM aha_admin_audit WHERE action='order.receipt' AND target=$1 AND created_at>now()-interval '1 day'",[orderId]);
    if(count.n>=3) throw new AdminAuthError('Three receipt requests are already recorded today. Check delivery before sending again.',429);
    const {rowCount}=await client.query("INSERT INTO aha_order_notifications(dedupe_key,kind,recipient,payload_json) VALUES($1,'order_confirmed',$2,$3) ON CONFLICT DO NOTHING",[`${orderId}:receipt_resend:${input.requestId}`,recipient,JSON.stringify(payload)]);
    if(rowCount) {
      await client.query("UPDATE aha_order_notifications SET state='sent',last_error_code='superseded_by_verified_receipt',provider_message_id=NULL,updated_at=now() WHERE kind='order_confirmed' AND split_part(dedupe_key,':',1)=$1 AND state IN ('pending','attention') AND dedupe_key<>$2",[orderId,`${orderId}:receipt_resend:${input.requestId}`]);
      await client.query('UPDATE aha_checkout_sessions SET notification_email=$1 WHERE square_order_id=$2',[recipient,orderId]);
      await client.query('UPDATE aha_fulfillment_orders SET customer_email=$1 WHERE square_order_id=$2',[recipient,orderId]);
      await client.query("INSERT INTO aha_admin_audit(user_id,action,target,detail_json) VALUES($1,'order.receipt',$2,$3)",[user.id,orderId,JSON.stringify({reason,requestId:input.requestId,recipientHash:hash(recipient)})]);
    }
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK');throw error; } finally {client.release();}
  return {message:'Receipt saved for delivery to the verified address.'};
}
export const dispatchOrderMail = (db,env) => createNotificationRuntime({database:db,env}).service.dispatch(2);
