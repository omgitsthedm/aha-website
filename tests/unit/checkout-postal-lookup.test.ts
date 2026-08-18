// The checkout form's ZIP-lookup failure taxonomy. This is the code that
// decides whether a free, unauthenticated third-party service is allowed to
// refuse a real customer's money, so every branch is pinned here.
//
// The rule: ONLY a successful lookup that positively contradicts the typed
// city/state may block. A 404, a 5xx, a timeout, an unreachable host or a body
// we cannot read must all fall through to "unverified" and let the sale happen.
//
// 404 matters most. api.zippopotam.us is a free GeoNames extract, not USPS —
// probed live against the real service, these deliverable US ZIPs all 404:
//   09021 (APO/AE), 00901 (San Juan, PR), 96799 (Pago Pago, AS)
// while 11201 and 91367 return 200. Treating 404 as "no such ZIP" hard-blocks
// military families and territory customers at the Pay button.
import { describe, expect, it } from "vitest";
import { lookupPostalPlaces } from "@/components/checkout/CheckoutForm";
import { verifyPostalCode } from "@/lib/checkout/postal-verification";
import { getSubmissionBlockReason, type ShippingContact } from "@/lib/checkout/shipping-contact";

const URL = "https://api.zippopotam.us/us/11201";

/** The documented 200 shape for 11201. */
const brooklynBody = JSON.stringify({
  "post code": "11201",
  country: "United States",
  places: [{ "place name": "Brooklyn", state: "New York", "state abbreviation": "NY" }],
});

/** Real Response objects — a hand-rolled stub would only prove the stub. */
function respondWith(response: Response): typeof fetch {
  return (async () => response) as unknown as typeof fetch;
}

function throwingFetch(error: unknown): typeof fetch {
  return (async () => { throw error; }) as unknown as typeof fetch;
}

function contact(over: Partial<ShippingContact> = {}): ShippingContact {
  return {
    email: "customer@example.com",
    shippingName: "Taylor Customer",
    address1: "1 Main Street",
    address2: "Apt 4B",
    city: "Brooklyn",
    state: "NY",
    zip: "11201",
    country: "US",
    ...over,
  };
}

/**
 * Exactly what the component computes: `validate()` is
 * `getSubmissionBlockReason(contact, postalVerdict)` (CheckoutForm.tsx), and
 * `payBlocked` gates on the same verdict being "blocked". So a null here means
 * the Pay button is live and pay()/payWallet()/Cash App will all proceed.
 */
async function submissionOutcome(c: ShippingContact, fetchImpl: typeof fetch) {
  // `lookupPostalPlaces` returns the lookup itself — one value, no wrapper —
  // so the component cannot pair a status with a stale "was it a 404" flag.
  const outcome = await lookupPostalPlaces(URL, undefined, fetchImpl);
  const verdict = verifyPostalCode({
    country: c.country, zip: c.zip, city: c.city, state: c.state, lookup: outcome,
  });
  return { outcome, verdict, blockReason: getSubmissionBlockReason(c, verdict) };
}

describe("lookupPostalPlaces — a successful, readable answer is the only positive answer", () => {
  it("200 that matches the typed city/state: resolved, confirmed, sale proceeds", async () => {
    const { outcome, verdict, blockReason } = await submissionOutcome(
      contact(), respondWith(new Response(brooklynBody, { status: 200 })),
    );
    expect(outcome).toEqual({
      status: "resolved",
      places: [{ city: "Brooklyn", state: "New York", stateCode: "NY" }],
    });
    expect(verdict.status).toBe("ok");
    expect(blockReason).toBeNull();
  });

  it("200 that contradicts the typed state: the one remote answer allowed to block", async () => {
    // Boston, MA against a ZIP the service resolves to Brooklyn, NY. A parcel
    // labelled this way leaves for the wrong city and comes back at AHA's cost.
    const { outcome, verdict, blockReason } = await submissionOutcome(
      contact({ city: "Boston", state: "MA" }), respondWith(new Response(brooklynBody, { status: 200 })),
    );
    expect(outcome.status).toBe("resolved");
    expect(verdict.status).toBe("blocked");
    expect(blockReason).toContain("Brooklyn");
  });
});

describe("lookupPostalPlaces — nothing but a contradiction may stop the sale", () => {
  it("404 is 'not in this dataset', not 'no such ZIP' — soft flag, no block", async () => {
    // The live service returns 404 with a `{}` body for these.
    const { outcome, verdict, blockReason } = await submissionOutcome(
      contact({ city: "APO", state: "AE", zip: "09021" }),
      respondWith(new Response("{}", { status: 404 })),
    );
    expect(outcome).toEqual({ status: "not-in-dataset" });
    expect(verdict.status).toBe("unverified");
    expect(blockReason).toBeNull();
  });

  it("keeps every real-but-unlisted US ZIP chargeable", async () => {
    // Each of these 404s against the real api.zippopotam.us today.
    const unlisted: Array<[string, string, string]> = [
      ["09021", "APO", "AE"],       // US Armed Forces Europe
      ["09501", "APO", "AA"],       // US Armed Forces Americas
      ["00901", "San Juan", "PR"],  // Puerto Rico
      ["00601", "Adjuntas", "PR"],
      ["00926", "San Juan", "PR"],
      ["96910", "Hagatna", "GU"],   // Guam
      ["00802", "St Thomas", "VI"], // US Virgin Islands
      ["96799", "Pago Pago", "AS"], // American Samoa
    ];
    for (const [zip, city, state] of unlisted) {
      const { blockReason } = await submissionOutcome(
        contact({ zip, city, state }), respondWith(new Response("{}", { status: 404 })),
      );
      expect(blockReason, `${zip} must stay chargeable`).toBeNull();
    }
  });

  it("500 is the service's problem, never the shopper's", async () => {
    const { outcome, verdict, blockReason } = await submissionOutcome(
      contact(), respondWith(new Response("upstream exploded", { status: 500 })),
    );
    expect(outcome).toEqual({ status: "unavailable" });
    expect(verdict.status).toBe("unverified");
    expect(blockReason).toBeNull();
  });

  it("no non-2xx status blocks, and none of them is ever reported as 'not found' except 404", async () => {
    for (const status of [400, 401, 403, 404, 408, 429, 500, 502, 503, 504]) {
      const { outcome, blockReason } = await submissionOutcome(
        contact(), respondWith(new Response("{}", { status })),
      );
      expect(outcome.status, `HTTP ${status}`).toBe(status === 404 ? "not-in-dataset" : "unavailable");
      expect(blockReason, `HTTP ${status} must not block`).toBeNull();
    }
  });

  it("an unreachable host (offline / CSP / DNS) falls through", async () => {
    const { outcome, verdict, blockReason } = await submissionOutcome(
      contact(), throwingFetch(new TypeError("Failed to fetch")),
    );
    expect(outcome).toEqual({ status: "unavailable" });
    expect(verdict.status).toBe("unverified");
    expect(blockReason).toBeNull();
  });

  it("the hard abort timeout falls through instead of wedging the Pay button", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    const { outcome, blockReason } = await submissionOutcome(contact(), throwingFetch(abort));
    expect(outcome).toEqual({ status: "unavailable" });
    expect(blockReason).toBeNull();
  });

  it("a malformed 200 body is unreadable, not a contradiction", async () => {
    const { outcome, verdict, blockReason } = await submissionOutcome(
      contact({ city: "Boston", state: "MA" }), // typed address disagrees with nothing we can read
      respondWith(new Response("{\"places\": [", { status: 200 })),
    );
    expect(outcome).toEqual({ status: "unavailable" });
    expect(verdict.status).toBe("unverified");
    expect(blockReason).toBeNull();
  });

  it("a well-formed 200 carrying no usable place is treated the same way", async () => {
    for (const body of ["{}", '{"places":[]}', '{"places":"nope"}', '{"places":[{"state":"New York"}]}', "null"]) {
      const { outcome, blockReason } = await submissionOutcome(
        contact({ city: "Boston", state: "MA" }), respondWith(new Response(body, { status: 200 })),
      );
      expect(outcome, body).toEqual({ status: "unavailable" });
      expect(blockReason, body).toBeNull();
    }
  });
});

describe("the soft nudge rides on the same value as the gate", () => {
  // The component renders the "give it a second look" line on
  // `postal.status === "not-in-dataset"` and computes the Pay gate from the
  // same `postal`. One value means the copy and the gate cannot disagree, and
  // an impossible pairing (a resolved answer that also claims "not found")
  // is no longer representable.
  const nudges = (lookup: Awaited<ReturnType<typeof lookupPostalPlaces>>) => lookup.status === "not-in-dataset";

  it("flags only the 404, and never alongside a resolved answer", async () => {
    const notInDataset = await lookupPostalPlaces(URL, undefined, respondWith(new Response("{}", { status: 404 })));
    const ok = await lookupPostalPlaces(URL, undefined, respondWith(new Response(brooklynBody, { status: 200 })));
    const down = await lookupPostalPlaces(URL, undefined, respondWith(new Response("boom", { status: 503 })));
    expect(nudges(notInDataset)).toBe(true);
    expect(nudges(ok)).toBe(false);
    expect(ok.status).toBe("resolved");
    expect(nudges(down)).toBe(false);
  });
});

describe("what the network can never take away", () => {
  it("a locally-invalid format still blocks — proved offline, no lookup involved", async () => {
    const { verdict, blockReason } = await submissionOutcome(
      contact({ zip: "1120" }), respondWith(new Response(brooklynBody, { status: 200 })),
    );
    expect(verdict.status).toBe("blocked");
    expect(blockReason).toBe("Enter a valid 5-digit US ZIP code.");
  });

  it("the address-completeness gate still runs ahead of any lookup verdict", async () => {
    const fetchImpl = respondWith(new Response("{}", { status: 404 }));
    expect((await submissionOutcome(contact({ email: "" }), fetchImpl)).blockReason)
      .toBe("Enter a valid email for your receipt.");
    expect((await submissionOutcome(contact({ address1: "" }), fetchImpl)).blockReason)
      .toBe("Complete your shipping address.");
    expect((await submissionOutcome(contact({ state: "" }), fetchImpl)).blockReason)
      .toBe("State/province is required.");
  });
});
