// The Track Order page renders ONE string, `customerStatus`, in success green.
// orders.customer_status is written by eight callers with no precedence rule
// between the refund path and the fulfillment path, so a shipping callback
// landing after a refund used to erase the refund from that string entirely.
// These pin the derived value, which composes the two columns that cannot race.
import { describe, expect, it } from "vitest";
import { shopperOrderStatus } from "@/lib/commerce/customer-status";
import {
  ACCEPTED_UNPROCESSED_STATUS,
  PARTIALLY_CANCELED_SHIPPED_STATUS,
  customerStatusFor,
} from "@/lib/commerce/fulfillment-state";
import { REFUND_ORDER_STATE } from "@/lib/commerce/webhooks";

describe("shopper-facing order status", () => {
  it("says nothing new when no money has gone back", () => {
    // Equal to the stored column by construction: every fulfillment-path writer
    // stores customerStatusFor(fulfillmentStatus) alongside the status itself.
    for (const status of [
      "not_started", "queued", "draft_created", ACCEPTED_UNPROCESSED_STATUS,
      "confirmed", "partially_shipped", "shipped", "delivered", "canceled",
      "manual_review", PARTIALLY_CANCELED_SHIPPED_STATUS,
    ]) {
      expect(shopperOrderStatus({ paymentStatus: "paid", fulfillmentStatus: status }))
        .toBe(customerStatusFor(status));
    }
  });

  it("keeps a full refund visible after the order ships", () => {
    // The regression: refund lands, then a shipped callback overwrites
    // customer_status to "Shipped" and the shopper is never told about the money.
    expect(shopperOrderStatus({
      paymentStatus: REFUND_ORDER_STATE.full.paymentStatus,
      fulfillmentStatus: "shipped",
    })).toBe(REFUND_ORDER_STATE.full.customerStatus);

    expect(shopperOrderStatus({
      paymentStatus: REFUND_ORDER_STATE.full.paymentStatus,
      fulfillmentStatus: "delivered",
    })).toBe(REFUND_ORDER_STATE.full.customerStatus);
  });

  it("tells both halves of the truth on a partial refund", () => {
    // Neither half alone is honest: "Shipped" hides money owed, "Partially
    // refunded" hides a shipment the shopper was already emailed about.
    expect(shopperOrderStatus({
      paymentStatus: REFUND_ORDER_STATE.partial.paymentStatus,
      fulfillmentStatus: "shipped",
    })).toBe("Shipped (partially refunded)");

    expect(shopperOrderStatus({
      paymentStatus: REFUND_ORDER_STATE.partial.paymentStatus,
      fulfillmentStatus: "confirmed",
    })).toBe("In production (partially refunded)");
  });

  it("does not stack a refund clause on a status that has no progress to report", () => {
    expect(shopperOrderStatus({
      paymentStatus: REFUND_ORDER_STATE.partial.paymentStatus,
      fulfillmentStatus: "not_started",
    })).toBe(REFUND_ORDER_STATE.partial.customerStatus);
  });

  it("never reports a refund the payment status does not claim", () => {
    for (const status of ["created", "pending", "paid", "failed"]) {
      expect(shopperOrderStatus({ paymentStatus: status, fulfillmentStatus: "shipped" }))
        .toBe("Shipped");
    }
  });
});
