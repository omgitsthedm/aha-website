import { reconcilePaidOrders } from "../../lib/commerce/reconciliation";

export default async () => {
  const result = await reconcilePaidOrders(3);
  console.log(JSON.stringify({ job: "reconcile-orders", ...result }));
  return new Response(null, { status: 204 });
};

export const config = { schedule: "*/15 * * * *" };
