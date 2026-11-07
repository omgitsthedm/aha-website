import { recordProgress } from './lifecycle.mjs';

export function carrierCode(value) {
  const text=String(value ?? '').toLowerCase();
  if(text.includes('usps')) return 'USPS';
  if(text.includes('fedex')) return 'FedEx';
  if(text.includes('ups')) return 'UPS';
  if(text.includes('dhl')) return 'DHLExpress';
  return null;
}
export function trackerObservation(tracker,row) {
  if(tracker?.mode!=='production' || tracker.tracking_code!==row.tracking_number || !/^trk_[a-z0-9]+$/i.test(tracker.id ?? '')) throw new Error('tracking_identity_mismatch');
  if(row.tracker_id && row.tracker_id!==tracker.id) throw new Error('tracking_identity_mismatch');
  if(carrierCode(row.carrier) && tracker.carrier!==carrierCode(row.carrier)) throw new Error('tracking_carrier_mismatch');
  const updated=new Date(tracker.updated_at);
  if(!Number.isFinite(updated.getTime()) || updated.getTime()>Date.now()+300000) throw new Error('tracking_timestamp_invalid');
  const statuses=['unknown','pre_transit','in_transit','out_for_delivery','delivered','available_for_pickup','return_to_sender','failure','cancelled','error'];
  if(!statuses.includes(tracker.status)) throw new Error('tracking_status_invalid');
  const delivery=tracker.status==='delivered' ? [...(tracker.tracking_details ?? [])].reverse().find(scan=>scan.status==='delivered' && Number.isFinite(Date.parse(scan.datetime)))?.datetime : null;
  if(delivery && (Date.parse(delivery)>updated.getTime()+300000 || Date.parse(delivery)>Date.now()+300000)) throw new Error('tracking_timestamp_invalid');
  return {id:tracker.id,status:tracker.status,updated:updated.toISOString(),deliveredAt:delivery ? new Date(delivery).toISOString() : null};
}
export function quantitiesDelivered(expected,parcels) {
  const quantities=new Map();
  for(const parcel of parcels.filter(p=>p.status==='delivered' && p.delivered_at)) for(const item of parcel.items ?? [])
    if(Number.isInteger(item.quantity) && item.quantity>0) quantities.set(item.sku,(quantities.get(item.sku) ?? 0)+item.quantity);
  const wanted=new Map();
  for(const item of expected) wanted.set(item.sku,(wanted.get(item.sku) ?? 0)+Number(item.quantity));
  return wanted.size>0 && [...wanted].every(([sku,count])=>count>0 && (quantities.get(sku) ?? 0)>=count);
}
const json=v=>typeof v==='string'?JSON.parse(v):v;
export async function applyTracker(db,env,row,tracker) {
  const value=trackerObservation(tracker,row);
  await db.sql`UPDATE aha_shipment_tracking SET tracker_id=${value.id},status=${value.status},provider_updated_at=${value.updated},
    delivered_at=${value.deliveredAt},checked_at=now(),next_attempt_at=now()+interval '1 hour',last_error_code=NULL
    WHERE square_order_id=${row.square_order_id} AND tracking_number=${row.tracking_number}
      AND (provider_updated_at IS NULL OR provider_updated_at<=${value.updated})
      AND (status<>'delivered' OR ${value.status}='delivered')`;
  const parcels=await db.sql`SELECT * FROM aha_shipment_tracking WHERE square_order_id=${row.square_order_id}`;
  const [order]=await db.sql`SELECT submitted_items,state FROM aha_fulfillment_orders WHERE square_order_id=${row.square_order_id}`;
  if(order?.state==='shipped' && quantitiesDelivered(json(order.submitted_items),parcels.map(p=>({...p,items:json(p.items)})))) {
    const deliveredAt=new Date(Math.max(...parcels.filter(p=>p.delivered_at).map(p=>new Date(p.delivered_at).getTime()))).toISOString();
    await db.sql`UPDATE aha_fulfillment_orders SET delivered_at=COALESCE(delivered_at,${deliveredAt}) WHERE square_order_id=${row.square_order_id}`;
    await recordProgress(db,env,row.square_order_id,'delivered','carrier:easypost');
  } else if(['failure','return_to_sender'].includes(value.status)) await recordProgress(db,env,row.square_order_id,'delivery_issue','carrier:easypost');
}

export async function runTracking({db,env,fetchImpl=fetch,now=()=>Date.now()}) {
  // Only parcels whose purchased contents were recorded by this release enter
  // delivery automation. Old labels without item evidence are never guessed.
  await db.sql`INSERT INTO aha_shipment_tracking(square_order_id,tracking_number,carrier,items)
    SELECT f.square_order_id,t->>'trackingNumber',t->>'carrier',t->'items'
    FROM aha_fulfillment_orders f CROSS JOIN LATERAL jsonb_array_elements(f.tracking) t
    WHERE f.state IN ('shipped','shipped_partial','ready_to_ship') AND jsonb_array_length(COALESCE(t->'items','[]'::jsonb))>0
      AND t->>'trackingNumber' IS NOT NULL
    ON CONFLICT(square_order_id,tracking_number) DO UPDATE SET items=EXCLUDED.items`;
  const key=env.get('AHA_EASYPOST_API_KEY');
  if(env.get('AHA_TRACKING_ENABLED')!=='true' || !key) return {configured:false,processed:0};
  const deadline=now()+20000;let processed=0;
  const rows=await db.sql`WITH due AS (SELECT square_order_id,tracking_number FROM aha_shipment_tracking
    WHERE delivered_at IS NULL AND next_attempt_at<=now() ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 4)
    UPDATE aha_shipment_tracking t SET next_attempt_at=now()+interval '5 minutes' FROM due
    WHERE t.square_order_id=due.square_order_id AND t.tracking_number=due.tracking_number RETURNING t.*`;
  for(const row of rows) {
    if(now()>deadline-3000) break;
    try {
      const carrier=carrierCode(row.carrier);
      if(!carrier) throw new Error('tracking_carrier_unsupported');
      if(!row.tracker_id) {
        // A hard monthly registration ceiling also bounds pay-per-shipment use.
        const limit=Number(env.get('AHA_TRACKING_MONTHLY_LIMIT') || '100');
        if(!Number.isInteger(limit) || limit<1 || limit>10000) throw new Error('tracking_limit_invalid');
        const [reserved]=await db.sql`WITH allocation AS (
          INSERT INTO aha_tracking_budgets(month,registrations)
          SELECT date_trunc('month',now())::date,1 WHERE EXISTS(SELECT 1 FROM aha_shipment_tracking
            WHERE square_order_id=${row.square_order_id} AND tracking_number=${row.tracking_number} AND registration_reserved_at IS NULL)
          ON CONFLICT(month) DO UPDATE SET registrations=aha_tracking_budgets.registrations+1
            WHERE aha_tracking_budgets.registrations<${limit} RETURNING month
        ) UPDATE aha_shipment_tracking SET registration_reserved_at=COALESCE(registration_reserved_at,now())
          WHERE square_order_id=${row.square_order_id} AND tracking_number=${row.tracking_number}
            AND (registration_reserved_at>now()-interval '2 days' OR
              (registration_reserved_at IS NULL AND EXISTS(SELECT 1 FROM allocation))) RETURNING tracking_number`;
        if(!reserved) throw new Error('tracking_registration_review');
      }
      const response=await fetchImpl(`https://api.easypost.com/v2/trackers${row.tracker_id?`/${encodeURIComponent(row.tracker_id)}`:''}`,{
        method:row.tracker_id?'GET':'POST',headers:{authorization:`Basic ${Buffer.from(`${key}:`).toString('base64')}`,'content-type':'application/json'},
        ...(row.tracker_id?{}:{body:JSON.stringify({tracker:{tracking_code:row.tracking_number,carrier}})}),signal:AbortSignal.timeout(Math.max(1000,Math.min(8000,deadline-now())))});
      if(!response.ok) throw new Error(`tracking_http_${response.status}`);
      await applyTracker(db,env,row,await response.json());processed++;
    } catch(error) {
      const code=/^tracking_[a-z0-9_]+$/.test(error.message)?error.message:'tracking_request_failed';
      await db.sql`UPDATE aha_shipment_tracking SET checked_at=now(),next_attempt_at=now()+interval '1 hour',last_error_code=${code}
        WHERE square_order_id=${row.square_order_id} AND tracking_number=${row.tracking_number}`;
    }
  }
  return {configured:true,processed};
}
