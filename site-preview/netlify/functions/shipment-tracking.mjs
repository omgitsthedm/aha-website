import { getDatabase } from '@netlify/database';
import { AHA_SITE_ID } from '../../server/fulfillment/runtime.mjs';
import { runTracking } from '../../server/orders/tracking.mjs';
import { trackWorker } from '../../server/operations/worker.mjs';
export default async function shipmentTracking(_request,context) {
  if(context?.site?.id!==AHA_SITE_ID || context?.deploy?.context!=='production') return;
  const db=getDatabase();
  await trackWorker(db,'shipment-tracking',()=>runTracking({db,env:Netlify.env}),Netlify.env);
}
export const config={schedule:'2,17,32,47 * * * *'};
