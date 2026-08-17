import { describe, expect, it } from "vitest";
import {
  nextApliiqFulfillmentStatus,
  parseApliiqFulfillmentEvent,
} from "@/lib/commerce/apliiq-webhook-events";

describe("APLIIQ fulfillment webhook event parsing", () => {
  it("requires a fulfillment envelope and a durable provider reference", () => {
    expect(parseApliiqFulfillmentEvent({})).toBeNull();
    expect(parseApliiqFulfillmentEvent({ fulfillment: { status: "Shipped" } })).toBeNull();
    expect(parseApliiqFulfillmentEvent({ fulfillment: "not-an-object" })).toBeNull();
  });

  it("normalizes shipment data only after accepting the signed-event envelope", () => {
    expect(parseApliiqFulfillmentEvent({
      fulfillment: {
        order_id: 1234,
        status: "Success",
        tracking_company: "USPS",
        tracking_numbers: ["9400", "9400", 12],
        tracking_urls: ["https://tools.usps.com/track/9400", "http://untrusted.example/9400"],
      },
    })).toEqual({
      payload: {
        fulfillment: {
          order_id: "1234",
          status: "Success",
          tracking_company: "USPS",
          tracking_numbers: ["9400", "9400", 12],
          tracking_urls: ["https://tools.usps.com/track/9400", "http://untrusted.example/9400"],
        },
      },
      reference: { providerOrderId: "1234" },
      tracking: {
        status: "shipped",
        carrier: "USPS",
        trackingNumbers: ["9400"],
        trackingUrls: ["https://tools.usps.com/track/9400"],
      },
    });
  });

  it("uses request/reference aliases without treating unknown statuses as shipped", () => {
    const event = parseApliiqFulfillmentEvent({
      fulfillment: {
        request_id: "request-1",
        store_system_order_id: "aha-order-1",
        status: "awaiting review",
        tracking_numbers: ["must-not-upgrade"],
      },
    });

    expect(event?.reference).toEqual({
      providerRequestId: "request-1",
      providerReference: "aha-order-1",
    });
    expect(event?.tracking).toEqual({
      status: "unknown",
      trackingNumbers: ["must-not-upgrade"],
      trackingUrls: [],
    });
  });

  it("accepts an explicit root provider reference when APLIIQ nests only shipment data", () => {
    const event = parseApliiqFulfillmentEvent({
      reference: "aha-order-2",
      fulfillment: { status: "In Production" },
    });

    expect(event?.reference).toEqual({ providerReference: "aha-order-2" });
    expect(event?.tracking.status).toBe("in_production");
  });

  it("holds out-of-order progress callbacks and escalates terminal conflicts", () => {
    expect(nextApliiqFulfillmentStatus("shipped", "confirmed")).toBe("shipped");
    expect(nextApliiqFulfillmentStatus("shipped", "canceled")).toBe("manual_review");
    expect(nextApliiqFulfillmentStatus("canceled", "confirmed")).toBe("manual_review");
    expect(nextApliiqFulfillmentStatus("manual_review", "shipped")).toBe("manual_review");
  });
});
