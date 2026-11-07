import { getDatabase } from '@netlify/database';
import { requireProductionRequest } from '../../server/fulfillment/runtime.mjs';
import { handleOrderRequest } from '../../server/orders/requests.mjs';
export default async function orderRequest(request,context) {
  if(!requireProductionRequest(request,context)) return new Response(null,{status:404});
  try {return await handleOrderRequest(request,{db:getDatabase(),env:Netlify.env});}
  catch {return Response.json({error:'We could not save your request. Your message is still here. Try again or reply to your order email.'},{status:503,headers:{'cache-control':'no-store'}});}
}
export const config={path:'/api/orders/request',method:['POST']};
