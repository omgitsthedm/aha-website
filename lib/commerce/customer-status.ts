// THE shopper-facing order status string, derived at read time.
//
// `orders.customer_status` is a stored column with EIGHT writers — the refund
// path (recordOrderRefund), the payment-capture path, the Printful webhook, the
// APLIIQ webhook, syncOrderFulfillmentStatus, markManualReview and the
// reconciliation sweep — and NO precedence rule between them. Whichever event
// lands last wins.
//
// That is how a refund becomes invisible. Ops issues a courtesy refund on a
// $120 order, the column reads "Partially refunded"; the order then ships and
// syncOrderFulfillmentStatus overwrites it with "Shipped" under a WHERE clause
// that is only `orders.id = ?`. `refunded_amount_cents` stays > 0 and
// `payment_status` stays `partially_refunded`, but components/order/
// TrackOrderForm.tsx renders `customerStatus` and nothing else, in success
// green — so the one person the money belongs to is never told.
//
// This is the same collision `applySquareEvent` already fixed one column over:
// a later payment.* delivery used to walk a refunded order back to "paid" until
// that branch learned to skip REFUNDED_PAYMENT_STATUSES. The guard was never
// extended to customer_status, and the fulfillment path has four more writers.
//
// Rather than add a refund guard to all eight, compose the string from the two
// columns that genuinely own the two facts: `fulfillment_status` is written only
// by the fulfillment path and `payment_status` only by the payment/refund path,
// so they cannot race each other. In every case where no refund exists this
// returns exactly what the stored column holds — each writer sets
// customer_status to customerStatusFor(fulfillment_status) already.

import { customerStatusFor } from "./fulfillment-state";
import { REFUND_ORDER_STATE } from "./webhooks";

/**
 * `customerStatusFor`'s fallback copy, referenced rather than repeated so this
 * module cannot drift from it. It means "paid, nothing has happened yet".
 */
const NO_PROGRESS_YET = customerStatusFor("");

export function shopperOrderStatus(order: {
  paymentStatus: string;
  fulfillmentStatus: string;
}): string {
  const progress = customerStatusFor(order.fulfillmentStatus);

  // Money fully back is the headline whatever the goods did. Tracking rows are
  // rendered separately, so shipping progress is not lost by saying so.
  if (order.paymentStatus === REFUND_ORDER_STATE.full.paymentStatus) {
    return REFUND_ORDER_STATE.full.customerStatus;
  }

  // A partial refund needs BOTH halves of the truth, the same way
  // PARTIALLY_CANCELED_SHIPPED_STATUS does: the goods are moving AND some money
  // came back. Either half alone is a lie by omission.
  if (order.paymentStatus === REFUND_ORDER_STATE.partial.paymentStatus) {
    return progress === NO_PROGRESS_YET
      ? REFUND_ORDER_STATE.partial.customerStatus
      : `${progress} (partially refunded)`;
  }

  return progress;
}
