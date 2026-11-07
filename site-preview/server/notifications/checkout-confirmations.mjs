// Receipts belong to verified payments, independently of the supplier switch.
// Reuses the order-id outbox key, so pay, status, webhook and retry converge.
import { createSquareCheckoutGateway } from "../checkout/square.mjs";
import { checkoutConfig } from "../checkout/runtime.mjs";
import { AHA_FULFILLMENT_CATALOG } from "../fulfillment/catalog.mjs";

const json = (value) => typeof value === "string" ? JSON.parse(value) : value;
export function createCheckoutConfirmations({ database, service, env, square }) {
  const config = checkoutConfig(env);
  const gateway = square ?? createSquareCheckoutGateway({ accessToken: config.accessToken });
  async function enqueue(session) {
    if (session?.state !== "completed" || !session.square_order_id || !session.square_payment_id) return null;
    const address = json(session.shipping_address_json);
    const cart = json(session.cart_json);
    if (!Array.isArray(cart) || !cart.length) return null;
    return service.enqueueConfirmation({
      recipient: session.notification_email || address?.email, orderId: session.square_order_id, orderNumber: json(session.order_payload_json)?.reference_id || session.square_order_id,
      totalAmount: session.total_cents, currency: session.currency,
      items: cart.map((item) => ({ title: item.title ?? AHA_FULFILLMENT_CATALOG[item.variationId]?.title ?? String(item.product ?? "Your piece").replaceAll("_", " "), size: item.size, quantity: item.quantity })),
    });
  }
  async function queueCheckout(checkoutId) {
    const [session] = await database.sql`SELECT * FROM aha_checkout_sessions WHERE checkout_id = ${checkoutId} AND state = 'completed' LIMIT 1`;
    return enqueue(session);
  }
  async function queueSquarePayment(paymentId, verifiedPayment) {
    if (!config.accessToken || !config.locationId) return null;
    const payment = verifiedPayment ?? await gateway.getPayment(paymentId);
    if (payment?.id !== paymentId || payment.status !== "COMPLETED" || payment.location_id !== config.locationId || !payment.order_id) return null;
    // Match an order we actually created, including amount and currency. Never
    // turn a POS/custom receipt or a failed/quoted attempt into a website order.
    const [session] = await database.sql`
      UPDATE aha_checkout_sessions SET state = 'completed', square_payment_id = ${paymentId},
        processing_lease_expires_at = NULL, last_error_code = NULL,
        updated_at = CASE WHEN state = 'completed' THEN updated_at ELSE now() END
      WHERE square_order_id = ${payment.order_id} AND state IN ('processing', 'unknown', 'completed')
        AND payment_submission_started_at IS NOT NULL
        AND (square_payment_id IS NULL OR square_payment_id = ${paymentId})
        AND total_cents = ${payment.amount_money?.amount ?? -1} AND currency = ${payment.amount_money?.currency ?? ''}
      RETURNING *`;
    return enqueue(session);
  }
  async function recoverMissing() {
    const rows = await database.sql`
      SELECT c.checkout_id FROM aha_checkout_sessions c
      WHERE c.state = 'completed' AND c.square_payment_id IS NOT NULL AND c.square_order_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM aha_order_notifications n WHERE n.kind='order_confirmed' AND split_part(n.dedupe_key,':',1)=c.square_order_id)
      ORDER BY c.created_at ASC LIMIT 20`;
    for (const row of rows) await queueCheckout(row.checkout_id);
    return rows.length;
  }
  return { queueCheckout, queueSquarePayment, recoverMissing };
}
