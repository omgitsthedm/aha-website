import { getDatabase } from '@netlify/database';
import { AHA_SITE_ID } from '../../server/fulfillment/runtime.mjs';
import { trackWorker } from '../../server/operations/worker.mjs';
import { runSquareRecovery } from '../../server/operations/recovery.mjs';
export default async function squareRecovery(_request,context) {
  if(context?.site?.id !== AHA_SITE_ID || context?.deploy?.context !== 'production') return;
  const db=getDatabase();
  return trackWorker(db,'square-recovery',()=>runSquareRecovery({db,env:Netlify.env}),Netlify.env);
}
export const config={schedule:'7,22,37,52 * * * *'};
