// Independent monitoring receives no order/customer data, only a job outcome.
export async function heartbeat(env, job, ok, fetchImpl=fetch) {
  const key=`AHA_HEALTHCHECK_${job.toUpperCase().replaceAll('-','_')}_URL`;
  const value=env.get(key); if(!value) return false;
  let url;try {url=new URL(value);}catch{return false;}
  if(url.protocol!=='https:' || url.hostname!=='hc-ping.com' || !/^\/[a-f0-9-]{36}$/.test(url.pathname)) return false;
  try {const response=await fetchImpl(`${url.href}${ok?'':'/fail'}`,{method:'POST',body:ok?'ok':'failed',signal:AbortSignal.timeout(2000)});return response.ok;}catch{return false;}
}
