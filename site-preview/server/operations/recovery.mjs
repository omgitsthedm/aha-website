// Bounded provider reconciliation. Reads providers; never creates payments,
// refunds or supplier orders. Durable inboxes feed the existing guarded workers.
import { createSquareGateway } from '../fulfillment/square.mjs';
import { createNetlifyRepository } from '../fulfillment/repository.mjs';
const parsed = value => typeof value === 'string' ? JSON.parse(value) : value;

export async function ingestCommerceEvent(db, { eventId, kind, resourceId }) {
  await db.sql`INSERT INTO aha_commerce_events(event_id,kind,resource_id)
    VALUES(${eventId},${kind},${resourceId}) ON CONFLICT DO NOTHING`;
}
export async function refreshFinancials(db, square, paymentId, { deadline = Date.now() + 20_000 } = {}) {
  const remaining = () => { const ms = Math.min(8000, deadline - Date.now()); if (ms < 500) throw new Error('recovery_deferred'); return {timeoutMs:ms}; };
  const payment = await square.getPayment(paymentId, remaining());
  if (!payment?.order_id) return false;
  const [known] = await db.sql`SELECT square_order_id FROM aha_fulfillment_orders WHERE square_order_id=${payment.order_id} AND state <> 'ignored'
    UNION SELECT square_order_id FROM aha_checkout_sessions WHERE square_order_id=${payment.order_id} AND payment_submission_started_at IS NOT NULL LIMIT 1`;
  if (!known) return false;
  const order = await square.getOrder(payment.order_id, remaining());
  let pending=0; let failed=false;
  for (const id of payment.refund_ids ?? []) {
    const refund=await square.getRefund(id, remaining());
    if (refund.payment_id !== paymentId) throw new Error('refund_payment_mismatch');
    if (refund.status === 'PENDING') pending += Number(refund.amount_money?.amount ?? 0);
    if (['FAILED','REJECTED'].includes(refund.status)) failed=true;
  }
  const refunded=Number(payment.refunded_money?.amount ?? 0);
  const refundState=refunded > 0 ? (refunded >= payment.amount_money.amount ? 'refunded' : 'partial') : pending ? 'pending' : failed ? 'failed' : 'none';
  const cancelled=['CANCELED','CANCELLED'].includes(order.state);
  const fees=Array.isArray(payment.processing_fee) ? payment.processing_fee.reduce((sum,x)=>sum+Number(x.amount_money?.amount ?? 0),0) : null;
  await db.sql`INSERT INTO aha_order_financials(square_order_id,square_payment_id,payment_state,refund_state,refunded_cents,refund_pending_cents,refund_failed,cancellation_state,processing_fee_cents,provider_updated_at)
    VALUES(${order.id},${paymentId},${payment.status},${refundState},${refunded},${pending},${failed},${cancelled?'cancelled':'none'},${fees},${payment.updated_at ?? null})
    ON CONFLICT(square_order_id) DO UPDATE SET payment_state=EXCLUDED.payment_state,refund_state=EXCLUDED.refund_state,
      refunded_cents=EXCLUDED.refunded_cents,refund_pending_cents=EXCLUDED.refund_pending_cents,refund_failed=EXCLUDED.refund_failed,
      cancellation_state=EXCLUDED.cancellation_state,processing_fee_cents=EXCLUDED.processing_fee_cents,
      provider_updated_at=EXCLUDED.provider_updated_at,checked_at=now()
    WHERE aha_order_financials.provider_updated_at IS NULL OR EXCLUDED.provider_updated_at IS NULL OR EXCLUDED.provider_updated_at >= aha_order_financials.provider_updated_at`;
  if (refunded || pending || failed || cancelled) {
    await db.sql`UPDATE aha_fulfillment_orders SET state=CASE WHEN apliiq_order_id IS NULL AND attempt_count=0 THEN 'held' ELSE 'attention' END,
      last_error_code=${cancelled?'order_cancelled':`refund_${refundState}`},updated_at=now() WHERE square_order_id=${order.id} AND state <> 'ignored'`;
  }
  return true;
}
export async function runSquareRecovery({db,env,square=createSquareGateway({accessToken:env.get('AHA_SQUARE_ACCESS_TOKEN')}),now=()=>new Date()}) {
  const deadline=Date.now()+24_000; const repo=createNetlifyRepository(db);
  // Lease the cursor so a replay/manual invocation cannot advance another run.
  const [cursorRow]=await db.sql`UPDATE aha_commerce_cursors SET lease_expires_at=now()+interval '90 seconds'
    WHERE name='square-payments' AND (lease_expires_at IS NULL OR lease_expires_at<now()) RETURNING *`;
  if (cursorRow) {
    try {
      const value=parsed(cursorRow.value_json); const until=value.until || now().toISOString();
      const since=value.since || new Date(now().getTime()-86_400_000).toISOString();
      const data=await square.listPayments({location_id:env.get('AHA_SQUARE_LOCATION_ID'),begin_time:env.get('AHA_FULFILLMENT_START_AT') || '2026-10-15T00:00:00Z',
        updated_at_begin_time:since,updated_at_end_time:until,sort_field:'UPDATED_AT',sort_order:'ASC',limit:50,...(value.cursor?{cursor:value.cursor}:{})});
      for (const payment of data.payments ?? []) {
        if (payment.location_id !== env.get('AHA_SQUARE_LOCATION_ID')) continue;
        const version=payment.updated_at || payment.created_at;
        await repo.ingestSquareEvent({eventId:`sweep:${payment.id}:${version}`,paymentId:payment.id,eventCreatedAt:version});
        await ingestCommerceEvent(db,{eventId:`financial:${payment.id}:${version}`,kind:'payment',resourceId:payment.id});
      }
      // Ten-minute overlap covers eventual consistency; unique event IDs dedupe.
      const next=data.cursor ? {since,until,cursor:data.cursor} : {since:new Date(new Date(until).getTime()-600_000).toISOString()};
      await db.sql`UPDATE aha_commerce_cursors SET value_json=${JSON.stringify(next)},lease_expires_at=NULL,updated_at=now() WHERE name='square-payments'`;
    } catch(error) {
      await db.sql`UPDATE aha_commerce_cursors SET lease_expires_at=NULL WHERE name='square-payments'`;
      throw error;
    }
  }
  // Rotate existing AHA purchases as well: refunds and fees may change without
  // a payment webhook. A bounded hourly obligation avoids a full historical scan.
  const stale=await db.sql`SELECT c.square_payment_id FROM aha_checkout_sessions c
    LEFT JOIN aha_order_financials f ON f.square_order_id=c.square_order_id
    WHERE c.state='completed' AND c.square_payment_id IS NOT NULL
      AND (f.checked_at IS NULL OR f.checked_at<now()-interval '1 hour')
    ORDER BY f.checked_at ASC NULLS FIRST,c.created_at ASC LIMIT 6`;
  const bucket=now().toISOString().slice(0,13);
  for(const row of stale) await ingestCommerceEvent(db,{eventId:`periodic:${row.square_payment_id}:${bucket}`,kind:'payment',resourceId:row.square_payment_id});
  // Paginate all dispute states so a missed resolution is recovered too.
  const [disputeCursor]=await db.sql`UPDATE aha_commerce_cursors SET lease_expires_at=now()+interval '90 seconds'
    WHERE name='square-disputes' AND (lease_expires_at IS NULL OR lease_expires_at<now()) RETURNING *`;
  if(disputeCursor && Date.now()<deadline-3000) {
    try {
      const value=parsed(disputeCursor.value_json);
      const result=await square.listDisputes({location_id:env.get('AHA_SQUARE_LOCATION_ID'),...(value.cursor?{cursor:value.cursor}:{})},{timeoutMs:Math.min(8000,deadline-Date.now())});
      for(const dispute of result.disputes ?? []) await ingestCommerceEvent(db,{eventId:`dispute-sweep:${dispute.id}:${dispute.updated_at || dispute.version}`,kind:'dispute',resourceId:dispute.id});
      await db.sql`UPDATE aha_commerce_cursors SET value_json=${JSON.stringify(result.cursor?{cursor:result.cursor}:{})},lease_expires_at=NULL,updated_at=now() WHERE name='square-disputes'`;
    } catch(error) {
      await db.sql`UPDATE aha_commerce_cursors SET lease_expires_at=NULL WHERE name='square-disputes'`; throw error;
    }
  }
  // Short-lived abuse counters contain only hashes; discard expired buckets.
  await db.sql`DELETE FROM aha_commerce_rate_limits WHERE window_start<now()-interval '1 day'`;
  // Locally interrupted purchases are also reconciled when no webhook arrives.
  const unknown=await db.sql`SELECT checkout_id,square_order_id FROM aha_checkout_sessions
    WHERE state IN ('processing','unknown') AND square_order_id IS NOT NULL AND payment_submission_started_at < now()-interval '2 minutes'
    ORDER BY updated_at ASC LIMIT 5`;
  for(const row of unknown) {
    if(Date.now()>deadline-3000) break;
    const order=await square.getOrder(row.square_order_id,{timeoutMs:Math.min(8000,deadline-Date.now())});
    for(const tender of order.tenders ?? []) {
      const id=tender.payment_id || tender.id;
      if(id) await repo.ingestSquareEvent({eventId:`recovery:${row.checkout_id}:${id}`,paymentId:id});
    }
    await db.sql`UPDATE aha_checkout_sessions SET updated_at=now() WHERE checkout_id=${row.checkout_id} AND state IN ('processing','unknown')`;
  }
  let processed=0;
  while(processed<8 && Date.now()<deadline-3000) {
    const [event]=await db.sql`WITH next AS (SELECT event_id FROM aha_commerce_events WHERE processed_at IS NULL AND next_attempt_at<=now()
      AND (lease_expires_at IS NULL OR lease_expires_at<now()) ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE aha_commerce_events e SET lease_expires_at=now()+interval '90 seconds',attempt_count=attempt_count+1
      FROM next WHERE e.event_id=next.event_id RETURNING e.*`;
    if(!event) break;
    try {
      let paymentId=event.resource_id;
      if(event.kind==='refund') paymentId=(await square.getRefund(event.resource_id,{timeoutMs:Math.min(8000,deadline-Date.now())})).payment_id;
      if(event.kind==='dispute') {
        const dispute=await square.getDispute(event.resource_id,{timeoutMs:Math.min(8000,deadline-Date.now())});
        paymentId=dispute.disputed_payment?.payment_id;
        if(paymentId && await refreshFinancials(db,square,paymentId,{deadline})) {
          await db.sql`INSERT INTO aha_payment_disputes(dispute_id,square_payment_id,state,due_at)
            VALUES(${dispute.id},${paymentId},${dispute.state},${dispute.due_at ?? null})
            ON CONFLICT(dispute_id) DO UPDATE SET state=EXCLUDED.state,due_at=EXCLUDED.due_at,updated_at=now()`;
          const [summary]=await db.sql`SELECT bool_or(state NOT IN ('WON','LOST','ACCEPTED')) AS open,
            min(due_at) FILTER(WHERE state NOT IN ('WON','LOST','ACCEPTED')) AS due FROM aha_payment_disputes WHERE square_payment_id=${paymentId}`;
          const open=summary.open;
          await db.sql`UPDATE aha_order_financials SET dispute_state=${open?'open':dispute.state.toLowerCase()},dispute_due_at=${summary.due},checked_at=now() WHERE square_payment_id=${paymentId}`;
          if(open) await db.sql`UPDATE aha_fulfillment_orders SET state='attention',last_error_code='dispute_open',updated_at=now() WHERE square_payment_id=${paymentId} AND state <> 'ignored'`;
        }
      } else if(paymentId) await refreshFinancials(db,square,paymentId,{deadline});
      await db.sql`UPDATE aha_commerce_events SET processed_at=now(),lease_expires_at=NULL,last_error_code=NULL WHERE event_id=${event.event_id} AND attempt_count=${event.attempt_count}`;
      processed++;
    } catch {
      await db.sql`UPDATE aha_commerce_events SET lease_expires_at=NULL,last_error_code='provider_reconciliation_failed',
        next_attempt_at=now()+make_interval(mins=>LEAST(60,power(2,LEAST(attempt_count,6))::int)) WHERE event_id=${event.event_id} AND attempt_count=${event.attempt_count}`;
      break;
    }
  }
  return {processed};
}
