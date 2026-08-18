"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import type { SquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { trackCommerceEvent } from "@/lib/analytics/events";
import { INTERNATIONAL_SHIPPING_CENTS, SHIPPING_CLAIM_SENTENCE, SHIPPING_COUNTRY_OPTIONS, isInternational } from "@/lib/commerce/policies";
import { ExpressCheckout } from "@/components/checkout/ExpressCheckout";
import {
  parseZippopotamPlaces, postalLookupCode, postalLookupUrl, verifyPostalCode,
  type PostalLookup,
} from "@/lib/checkout/postal-verification";
import {
  STATE_REQUIRED, getAddressError, getSubmissionBlockReason,
  type ShippingContact,
} from "@/lib/checkout/shipping-contact";

type TokenResult = { status: string; token: string };
type SquareCard = { attach: (selector: string) => Promise<void>; tokenize: () => Promise<TokenResult> };
type SquareWallet = { attach?: (selector: string, opts?: unknown) => Promise<void>; tokenize: () => Promise<TokenResult> };
// Cash App Pay is event-based (tokenizes via an 'ontokenization' event, not a
// direct tokenize() call), so it has its own shape.
type SquareCashAppPay = {
  attach: (selector: string, opts?: unknown) => Promise<void>;
  addEventListener: (type: string, cb: (ev: { detail?: { tokenResult?: TokenResult } }) => void) => void;
};
type SquarePaymentRequest = unknown;
type VerificationResult = { token?: string };
type SquarePaymentsApi = {
  card: () => Promise<SquareCard>;
  giftCard?: () => Promise<SquareCard>;
  paymentRequest: (req: unknown) => SquarePaymentRequest;
  applePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
  googlePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
  afterpayClearpay?: (req: SquarePaymentRequest) => Promise<SquareWallet>;
  cashAppPay?: (req: SquarePaymentRequest, opts: unknown) => Promise<SquareCashAppPay>;
  verifyBuyer?: (token: string, details: unknown) => Promise<VerificationResult>;
};
interface CheckoutQuote {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePaymentsApi };
  }
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ZIP lookup timings. The debounce keeps a keystroke from firing a request; the
// hard abort guarantees the "checking" state can never wedge the Pay button on
// a stalled connection — it falls through to "unverified", which never blocks.
const POSTAL_LOOKUP_DEBOUNCE_MS = 500;
const POSTAL_LOOKUP_TIMEOUT_MS = 6_000;

// One api.zippopotam.us response is classified into ONE `PostalLookup` value —
// status and "was it a 404" travel together rather than as two fields that a
// render could catch half-updated.
const POSTAL_IDLE: PostalLookup = { status: "idle" };
const POSTAL_CHECKING: PostalLookup = { status: "checking" };
const POSTAL_UNAVAILABLE: PostalLookup = { status: "unavailable" };
/** 404 = absent from this dataset, NOT "this ZIP does not exist". Soft copy only. */
const POSTAL_NOT_IN_DATASET: PostalLookup = { status: "not-in-dataset" };

/**
 * Run one ZIP lookup and classify the result. Exported — and taking its fetch —
 * so the whole failure taxonomy is unit-testable without a browser, because
 * this function is the line between "we couldn't confirm" and "you can't pay".
 *
 * ONLY a 2xx whose body parses into at least one place is a positive answer,
 * and only that answer can go on to contradict the typed city/state. Every
 * other outcome → verdict "unverified" → the sale proceeds.
 *
 * A 404 in particular must not block: api.zippopotam.us is a free GeoNames
 * extract, not USPS. Probed live, 09021 (APO/AE), 00901 (San Juan, PR) and
 * 96799 (Pago Pago, AS) all 404 while being perfectly deliverable US ZIPs, so
 * blocking on 404 refuses money from military families and territory customers
 * — strictly worse than the return-to-sender it was meant to prevent.
 */
export async function lookupPostalPlaces(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<PostalLookup> {
  try {
    const res = await fetchImpl(url, init);
    // Not in the dataset. Soft signal only.
    if (res.status === 404) return POSTAL_NOT_IN_DATASET;
    // 5xx, 429, anything else non-2xx: the service's problem, never the shopper's.
    if (!res.ok) return POSTAL_UNAVAILABLE;
    // A malformed body throws out of json() and lands in the catch below.
    const places = parseZippopotamPlaces(await res.json());
    if (places.length === 0) return POSTAL_UNAVAILABLE;
    return { status: "resolved", places };
  } catch {
    return POSTAL_UNAVAILABLE; // offline / CSP / abort / unreadable body — fail open
  }
}

// Shipping/contact PII must not sit in this browser forever — on a shared machine
// an old entry silently prefills the next person's checkout. Keep the resume
// window that makes a reload or a crash mid-checkout survivable, then drop it.
const CONTACT_STORAGE_KEY = "aha-checkout-contact";
const CONTACT_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredContact {
  savedAt: number;
  contact: Partial<ShippingContact>;
}

// The "boarding pass" itinerary — like a plane ticket, it turns a form into a
// journey, building anticipation and answering "when do I get it?" before the
// shopper has to ask. Reinforces the made-to-order brand story at the moment of
// highest intent.
const JOURNEY_STEPS = [
  { label: "Order placed", detail: "Confirmed instantly, receipt to your inbox." },
  { label: "Printed to order", detail: "Production begins after you order - usually 2 to 5 business days." },
  { label: "Shipped with tracking", detail: "Tracking lands the moment it leaves the shop." },
  { label: "Yours to wear", detail: "Made after hours. Worn all day." },
];

interface Props {
  squareConfig: SquareWebPaymentsConfig;
}

export function CheckoutForm({ squareConfig }: Props) {
  const { items, hydrated, total, clearCart } = useCart();
  const router = useRouter();

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false); // SDK slow/failed to load — offer a reload
  const [slowPay, setSlowPay] = useState(false); // charge is taking a while (slow connection)
  const [status, setStatus] = useState<"idle" | "paying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");        // input value
  const [appliedPromo, setAppliedPromo] = useState("");  // code actually sent to the server
  const [promoInfo, setPromoInfo] = useState<{ label: string; percentage: string | null } | null>(null);
  const [promoInvalid, setPromoInvalid] = useState(false);
  const [contact, setContact] = useState<ShippingContact>({
    email: "", shippingName: "", address1: "", address2: "", city: "", state: "", zip: "", country: "US",
  });
  // One atom for the whole lookup: status and "absent from the dataset" cannot
  // be observed in an inconsistent pairing because there is no second field.
  const [postal, setPostal] = useState<PostalLookup>(POSTAL_IDLE);

  const paymentsRef = useRef<SquarePaymentsApi | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const applePayRef = useRef<SquareWallet | null>(null);
  const googlePayRef = useRef<SquareWallet | null>(null);
  const giftCardRef = useRef<SquareCard | null>(null);
  const [giftCardReady, setGiftCardReady] = useState(false);
  const afterpayRef = useRef<SquareWallet | null>(null);
  const cashAppRef = useRef<SquareCashAppPay | null>(null);
  // Always points at the current-quote charge fn, so Cash App Pay's one-time
  // event listener never fires a charge with a stale total.
  const submitTokenRef = useRef<(token: string) => void>(() => {});
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  // Latches once a typed address has produced a real quote. From then on the
  // address-gated wallets below (which show the exact tax-inclusive total) take
  // over from the subtotal-priced express block, and the express block stays
  // hidden — one wallet control on the page, and never a remount loop as the
  // shopper edits an address field.
  const [addressQuoted, setAddressQuoted] = useState(false);
  const [afterpayReady, setAfterpayReady] = useState(false);
  const [cashAppReady, setCashAppReady] = useState(false);
  // Stable idempotency key for this checkout attempt. Kept the same across network retries so a
  // lost-response-after-charge is deduped server-side; rotated only after a definitive decline.
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current && typeof crypto !== "undefined") {
    idempotencyKeyRef.current = crypto.randomUUID();
  }

  const initSquare = useCallback(async () => {
    if (!window.Square || paymentsRef.current) return;
    if (!squareConfig.applicationId || !squareConfig.locationId) {
      setError("Checkout is temporarily unavailable. Please try again shortly.");
      return;
    }
    try {
      const payments = window.Square.payments(squareConfig.applicationId, squareConfig.locationId);
      paymentsRef.current = payments;
      const card = await payments.card();
      await card.attach("#aha-card");
      cardRef.current = card;
      setSdkReady(true);
      // Gift-card redemption (gated): a gift card is just another payment source.
      if (process.env.NEXT_PUBLIC_GIFT_CARDS_ENABLED === "true" && payments.giftCard) {
        try {
          const gc = await payments.giftCard();
          await gc.attach("#aha-giftcard");
          giftCardRef.current = gc;
          setGiftCardReady(true);
        } catch { /* gift cards not enabled in Square / unavailable */ }
      }
    } catch {
      setError("Could not load the secure card field. Refresh and try again.");
    }
  }, [squareConfig.applicationId, squareConfig.locationId]);

  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    if (window.Square) initSquare();
  }, [hydrated, items.length, initSquare]);

  // Watchdog: on a slow/blocked connection the Square SDK script can stall. If
  // the secure card field still isn't ready after 10s, surface a reload path
  // instead of a permanently disabled button.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    if (sdkReady) { setSdkFailed(false); return; }
    const t = window.setTimeout(() => { if (!sdkReady) setSdkFailed(true); }, 10_000);
    return () => window.clearTimeout(t);
  }, [hydrated, items.length, sdkReady]);

  // Restore a previously-typed address so a mid-checkout connection drop or
  // reload doesn't wipe the form. Card data is NEVER stored (Square holds it).
  // Anything older than CONTACT_TTL_MS is discarded on read and deleted, so a
  // shared machine can't prefill a stranger's name and address.
  useEffect(() => {
    const forget = () => { try { localStorage.removeItem(CONTACT_STORAGE_KEY); } catch { /* private mode */ } };
    try {
      const raw = localStorage.getItem(CONTACT_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") { forget(); return; }
      const record = parsed as Partial<StoredContact> & Partial<ShippingContact>;
      // Entries written before the TTL landed are a bare contact object. Accept
      // them once so nobody mid-checkout loses what they already typed.
      const savedAt = typeof record.savedAt === "number" ? record.savedAt : null;
      const saved = savedAt === null ? (record as Partial<ShippingContact>) : record.contact;
      const fresh = savedAt === null || Date.now() - savedAt < CONTACT_TTL_MS;
      if (!fresh || !saved) { forget(); return; }
      setContact((prev) => ({ ...prev, ...saved }));
    } catch { forget(); /* bad JSON — start fresh */ }
  }, []);

  useEffect(() => {
    try {
      const record: StoredContact = { savedAt: Date.now(), contact };
      localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(record));
    } catch { /* ignore */ }
  }, [contact]);

  // Keyless ZIP → city/state lookup. It still fills empty fields (the friction
  // cut Shopify gets from address autocomplete), but its real job is now to
  // VERIFY: a ZIP the service resolves to a different city/state ships the
  // parcel to the wrong place, fails delivery, and returns to AHA at AHA's
  // cost. That — and only that — is a blocking error (see `postalVerdict`).
  //
  // The request is keyed on (country, ZIP) only — the verdict is derived from
  // the typed city/state during render, so editing the city never re-fetches.
  // The one thing that can stop a sale from here is a SUCCESSFUL lookup that
  // positively contradicts the typed address; every other outcome (404, 5xx,
  // timeout, unreadable body, unreachable host) is classified as
  // "not-in-dataset" or "unavailable" by lookupPostalPlaces above, both of
  // which verify to "unverified" and never block. Full-street autocomplete
  // (Google Places) is a follow-up gated on an API key.
  useEffect(() => {
    const code = postalLookupCode(contact.country, contact.zip);
    // Unverifiable country, empty, or a locally-invalid format: no request to
    // make. A bad format is still reported by the verdict, offline.
    if (!code) { setPostal(POSTAL_IDLE); return; }
    setPostal(POSTAL_CHECKING);
    let cancelled = false;
    let abortTimer = 0;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      abortTimer = window.setTimeout(() => controller.abort(), POSTAL_LOOKUP_TIMEOUT_MS);
      const outcome = await lookupPostalPlaces(
        postalLookupUrl(contact.country, code), { signal: controller.signal },
      );
      window.clearTimeout(abortTimer);
      if (cancelled) return;
      setPostal(outcome);
      if (outcome.status !== "resolved") return;
      const [place] = outcome.places;
      setContact((prev) => ({
        ...prev,
        city: prev.city.trim() ? prev.city : place.city,
        state: prev.state.trim() ? prev.state : (place.stateCode || place.state),
      }));
    }, POSTAL_LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(abortTimer);
      controller.abort();
    };
  }, [contact.zip, contact.country]);

  // Derived, not stored: the pure verdict for what is typed right now.
  const postalVerdict = verifyPostalCode({
    country: contact.country, zip: contact.zip, city: contact.city, state: contact.state, lookup: postal,
  });
  // Soft nudge for a code the lookup has never heard of. Read off the same
  // single value as the verdict, so the copy can never disagree with the gate.
  // Deliberately not a verdict and deliberately not wired to
  // validate()/payBlocked: plenty of real ZIPs are missing from a free
  // dataset, so this asks and never refuses.
  const postalNotFound = postal.status === "not-in-dataset" && postalVerdict.status === "unverified";

  useEffect(() => {
    if (items.length > 0) {
      trackCommerceEvent({
        name: "begin_checkout",
        valueCents: total,
        currency: "USD",
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        // Cart data is product-only: never include checkout contact or address fields.
        items: items.map(({ productId, name, variationName, price, quantity }) => ({
          itemId: productId,
          itemName: name,
          itemVariant: variationName,
          priceCents: price,
          quantity,
        })),
      });
    }
  }, [items, total]);

  // Best-effort abandoned-cart capture: once a valid email + items exist, save a
  // snapshot so a recovery email can go out later if they don't finish. Fully
  // fire-and-forget (keepalive survives them leaving) — never blocks checkout.
  useEffect(() => {
    const email = contact.email.trim();
    if (!/.+@.+\..+/.test(email) || items.length === 0) return;
    const timer = window.setTimeout(() => {
      fetch("/api/checkout/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          email,
          subtotal: total,
          currency: "USD",
          items: items.map((i) => ({ title: i.name, size: i.variationName, quantity: i.quantity, lineTotal: i.price * i.quantity, slug: i.slug, variationId: i.variationId, productId: i.productId, price: i.price, priceFormatted: i.priceFormatted, image: i.image })),
        }),
      }).catch(() => { /* capture is best-effort */ });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [contact.email, items, total]);

  const loadQuote = useCallback(async () => {
    if (getAddressError(contact)) return null;
    setQuoteStatus("loading");
    setQuoteError(null);
    const body = JSON.stringify({
      lines: items.map((item) => ({ squareVariationId: item.variationId, quantity: item.quantity })),
      promoCode: appliedPromo || undefined,
      contact: {
        shippingName: contact.shippingName,
        shippingAddress: {
          address1: contact.address1, address2: contact.address2, city: contact.city, state: contact.state,
          zip: contact.zip, country: contact.country,
        },
      },
    });

    type QuoteResponse = { quote: CheckoutQuote; promo?: { label: string; percentage: string | null } | null; promoInvalid?: boolean };

    // One fetch with a 10s timeout. The quote is fully idempotent (no charge),
    // so it is safe to retry once on a pure network failure / timeout.
    const attempt = async (): Promise<QuoteResponse> => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch("/api/checkout-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          // A real business error (bad address, repriced, unavailable) — not retryable.
          const err = new Error(data.error || "Final pricing is unavailable.");
          (err as Error & { fatal?: boolean }).fatal = true;
          throw err;
        }
        return data as QuoteResponse;
      } finally {
        window.clearTimeout(timer);
      }
    };

    try {
      let data: QuoteResponse;
      try {
        data = await attempt();
      } catch (first) {
        // Retry once ONLY on a transient network/timeout failure, never on a business error.
        if ((first as Error & { fatal?: boolean }).fatal) throw first;
        await new Promise((r) => window.setTimeout(r, 800));
        data = await attempt();
      }
      setQuote(data.quote);
      setPromoInfo(data.promo ?? null);
      setPromoInvalid(Boolean(data.promoInvalid));
      setQuoteStatus("ready");
      return data.quote;
    } catch (quoteFailure) {
      setQuote(null);
      setQuoteStatus("error");
      const isFatal = (quoteFailure as Error & { fatal?: boolean }).fatal;
      setQuoteError(
        isFatal
          ? (quoteFailure instanceof Error ? quoteFailure.message : "Final pricing is unavailable.")
          : "Couldn't reach us to confirm your total — check your connection and retry."
      );
      return null;
    }
  }, [items, contact, appliedPromo]);

  useEffect(() => {
    setQuote(null);
    setApplePayReady(false);
    setGooglePayReady(false);
    setAfterpayReady(false);
    setCashAppReady(false);
    applePayRef.current = null;
    googlePayRef.current = null;
    afterpayRef.current = null;
    cashAppRef.current = null;
    if (getAddressError(contact)) {
      setQuoteStatus("idle");
      setQuoteError(null);
      return;
    }
    const timer = window.setTimeout(() => { void loadQuote(); }, 450);
    return () => window.clearTimeout(timer);
    // loadQuote already captures every address/cart input
  }, [loadQuote, contact]);

  useEffect(() => {
    if (!quote || !paymentsRef.current) return;
    let cancelled = false;
    const initWallets = async () => {
      try {
        const request = paymentsRef.current!.paymentRequest({
          countryCode: contact.country,
          currencyCode: quote.currency,
          total: { amount: (quote.total / 100).toFixed(2), label: "After Hours Agenda" },
        });
        try {
          const applePay = await paymentsRef.current!.applePay(request);
          if (!cancelled) { applePayRef.current = applePay; setApplePayReady(true); }
        } catch { /* Apple Pay unavailable on this device/domain */ }
        try {
          const googlePay = await paymentsRef.current!.googlePay(request);
          if (!cancelled) { googlePayRef.current = googlePay; setGooglePayReady(true); }
        } catch { /* Google Pay unavailable on this device */ }
        // BNPL / Cash App attempts only when enabled (avoids console noise +
        // wasted init on every checkout until they're turned on in Square).
        const bnplOn = process.env.NEXT_PUBLIC_BNPL_ENABLED === "true";
        try {
          if (bnplOn && paymentsRef.current!.afterpayClearpay) {
            const afterpay = await paymentsRef.current!.afterpayClearpay(request);
            if (!cancelled) { afterpayRef.current = afterpay; setAfterpayReady(true); }
          }
        } catch { /* Afterpay unavailable / not enabled in Square */ }
        try {
          if (bnplOn && paymentsRef.current!.cashAppPay) {
            // Cash App Pay needs its own request instance + a redirect target.
            const cashReq = paymentsRef.current!.paymentRequest({
              countryCode: contact.country, currencyCode: quote.currency,
              total: { amount: (quote.total / 100).toFixed(2), label: "After Hours Agenda" },
            });
            const cashAppPay = await paymentsRef.current!.cashAppPay(cashReq, {
              redirectURL: window.location.href, referenceId: idempotencyKeyRef.current || "aha-checkout",
            });
            cashAppPay.addEventListener("ontokenization", (ev) => {
              const tr = ev?.detail?.tokenResult;
              if (tr?.status === "OK" && tr.token) submitTokenRef.current(tr.token);
            });
            if (!cancelled) { cashAppRef.current = cashAppPay; setCashAppReady(true); }
          }
        } catch { /* Cash App Pay unavailable / not enabled in Square */ }
      } catch { /* paymentRequest unavailable */ }
    };
    void initWallets();
    return () => { cancelled = true; };
  }, [quote, contact.country, sdkReady]);

  useEffect(() => {
    if (quoteStatus === "ready") setAddressQuoted(true);
  }, [quoteStatus]);

  useEffect(() => {
    if (!googlePayReady || !googlePayRef.current?.attach) return;
    void googlePayRef.current.attach("#aha-gpay", {
      buttonColor: "white", buttonType: "long", buttonSizeMode: "fill",
    }).catch(() => setGooglePayReady(false));
  }, [googlePayReady]);

  useEffect(() => {
    if (!cashAppReady || !cashAppRef.current?.attach) return;
    void cashAppRef.current.attach("#aha-cashapp", { shape: "semiround", width: "full" }).catch(() => setCashAppReady(false));
  }, [cashAppReady]);

  // Two things block the charge, both of them proven contradictions: a postal
  // code that fails its country's format offline, and a resolved lookup that
  // disagrees with the typed city/state — a return-to-sender parcel billed back
  // to AHA. "Unverified" (404, 5xx, timeout, offline, unreadable body) never
  // blocks: a free service with no SLA cannot stop us taking money. See
  // lookupPostalPlaces above and shipping-contact.ts.
  const validate = (): string | null => getSubmissionBlockReason(contact, postalVerdict);

  // Shared charge path for card + wallet tokens.
  const submitWithToken = async (
    token: string, reviewedQuote: CheckoutQuote, verificationToken?: string
  ) => {
    setStatus("paying");
    setError(null);
    setSlowPay(false);
    // Reassure (don't abort) if the charge is slow — the request must run to
    // completion so we never leave a payment in an unknown state.
    const slowTimer = window.setTimeout(() => setSlowPay(true), 8_000);
    try {
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: token,
          idempotencyKey: idempotencyKeyRef.current,
          quotedTotal: reviewedQuote.total,
          quotedCurrency: reviewedQuote.currency,
          promoCode: appliedPromo || undefined,
          verificationToken,
          lines: items.map((i) => ({ squareVariationId: i.variationId, quantity: i.quantity })),
          contact: {
            email: contact.email,
            shippingName: contact.shippingName,
            shippingAddress: {
              address1: contact.address1, address2: contact.address2, city: contact.city, state: contact.state,
              zip: contact.zip, country: contact.country,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.code === "QUOTE_CHANGED" && data.quote) {
          setQuote(data.quote);
          setQuoteStatus("ready");
        }
        // Rotate the key ONLY on a CONFIRMED decline (server sets declined:true →
        // card definitively not charged). On an ambiguous failure (declined:false)
        // keep the same key so a retry is deduped by Square and never double-charges.
        if (res.status === 402 && data.declined === true) idempotencyKeyRef.current = crypto.randomUUID();
        window.clearTimeout(slowTimer);
        setSlowPay(false);
        setStatus("error");
        setError(data.error || "We couldn't complete the payment. Your card was not charged.");
        return;
      }
      window.clearTimeout(slowTimer);
      sessionStorage.setItem("aha-last-order", JSON.stringify({
        orderNumber: data.orderNumber,
        receiptUrl: typeof data.receiptUrl === "string" ? data.receiptUrl : null,
        items: items.map((item) => ({
          name: item.name,
          variationName: item.variationName,
          quantity: item.quantity,
          lineTotal: item.price * item.quantity,
          // Reorder fields (used only by the confirmation page's "Order again").
          productId: item.productId,
          slug: item.slug,
          variationId: item.variationId,
          price: item.price,
          priceFormatted: item.priceFormatted,
          image: item.image,
        })),
        subtotal: total, // gross pre-discount
        discount: Math.max(0, total - reviewedQuote.subtotal),
        total: reviewedQuote.total,
        currency: reviewedQuote.currency,
        shippingName: contact.shippingName,
        shippingAddress: {
          address1: contact.address1,
          address2: contact.address2,
          city: contact.city,
          state: contact.state,
          zip: contact.zip,
          country: contact.country,
        },
      }));
      clearCart();
      try { localStorage.removeItem(CONTACT_STORAGE_KEY); } catch { /* ignore */ }
      router.push(`/order-confirmed?order=${encodeURIComponent(data.orderNumber)}`);
    } catch {
      // Keep the key after an unknown network outcome so a retry is deduped server-side.
      window.clearTimeout(slowTimer);
      setSlowPay(false);
      setStatus("error");
      setError("Connection dropped. Tap Pay again. The retry uses the same payment key to prevent a duplicate charge.");
    }
  };

  // Keep the Cash App Pay event handler charging against the CURRENT quote.
  submitTokenRef.current = (token: string) => {
    if (validate() || !quote || quoteStatus !== "ready") return;
    void submitWithToken(token, quote);
  };

  const pay = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (status === "paying") return;
    setError(null);
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    if (!quote || quoteStatus !== "ready") {
      setError("Wait for the final tax-inclusive total before paying.");
      return;
    }
    if (!cardRef.current) { setError("Payment field is still loading."); return; }
    const t = await cardRef.current.tokenize();
    if (t.status !== "OK") { setError("Please check your card details and try again."); return; }
    let verificationToken: string | undefined;
    if (paymentsRef.current?.verifyBuyer) {
      try {
        const [firstName, ...lastNameParts] = contact.shippingName.trim().split(/\s+/);
        const verification = await paymentsRef.current.verifyBuyer(t.token, {
          amount: (quote.total / 100).toFixed(2),
          currencyCode: quote.currency,
          intent: "CHARGE",
          billingContact: {
            givenName: firstName,
            familyName: lastNameParts.join(" ") || "Customer",
            email: contact.email,
            // Both lines: an issuer's AVS check on an apartment address fails
            // more often when the unit number is missing from the verification.
            addressLines: [contact.address1, contact.address2].filter(Boolean),
            city: contact.city,
            state: contact.state,
            countryCode: contact.country,
            postalCode: contact.zip,
          },
        });
        verificationToken = verification.token;
      } catch {
        setError("We couldn't verify this card securely. Try again or use another payment method.");
        return;
      }
    }
    await submitWithToken(t.token, quote, verificationToken);
  };

  const payWallet = async (wallet: SquareWallet | null) => {
    if (!wallet || status === "paying") return;
    setError(null);
    const invalid = validate();
    if (invalid) { setError(`${invalid} It's needed to ship your order.`); return; }
    if (!quote || quoteStatus !== "ready") { setError("Wait for the final total before using a wallet."); return; }
    try {
      const t = await wallet.tokenize();
      if (t.status !== "OK") return; // shopper dismissed the wallet sheet
      await submitWithToken(t.token, quote);
    } catch {
      setError("Wallet payment didn't complete. Try again or use a card.");
    }
  };

  const field = "min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none";
  const labelC = "mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-muted";

  if (!hydrated) {
    return (
      <div className="px-4 pb-24 pt-32 md:px-6">
        <div className="mx-auto max-w-md border-t-2 border-accent pt-6 text-left">
          <h1 className="font-display text-4xl font-black uppercase tracking-[-0.05em] text-cream">Checkout</h1>
          <p className="mt-3 text-sm text-muted">Loading your saved bag…</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 pb-24 pt-32 md:px-6">
        <div className="mx-auto max-w-md border-t-2 border-accent pt-6 text-left">
          <h1 className="font-display text-4xl font-black uppercase tracking-[-0.05em] text-cream">Checkout</h1>
          <h2 className="mt-6 font-display text-2xl font-black uppercase tracking-[-0.04em] text-cream">Your bag is empty</h2>
          <p className="mt-3 text-sm text-muted">Nothing to check out yet.</p>
          <Link href="/shop" className="primary-action mt-6 inline-block min-h-12 px-6 py-4 text-sm">
            Shop the catalog
          </Link>
        </div>
      </div>
    );
  }

  // Display only. The charged amount comes from Square via buildSquareOrder.
  const shippingCents = isInternational(contact.country) ? INTERNATIONAL_SHIPPING_CENTS : 0;

  // The Pay button stays focusable in every state (aria-disabled, not disabled) so
  // it is never dropped from the tab order mid-checkout. pay() already returns
  // early with a user-facing message for each blocked state, so an activatable
  // button can't fire a charge before the quote is ready.
  const payBlocked = status === "paying" || quoteStatus !== "ready" || !sdkReady || postalVerdict.status === "blocked";
  // Persistently mounted below, so the transition into "calculating" and into
  // "ready" is actually announced — a live region that mounts with its text is not.
  const quoteAnnouncement =
    quoteStatus === "loading"
      ? "Calculating tax and final total…"
      : quoteStatus === "ready" && quote
        ? `Final total ready — ${money(quote.total)}.`
        : quoteStatus === "idle"
          ? "Enter your shipping address to see the final total."
          : "";

  return (
    <>
      <Script src={squareConfig.sdkUrl} strategy="afterInteractive" onLoad={initSquare} />
      <div className="px-4 pb-24 pt-28 md:px-6 md:pt-32">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          {/* Form */}
          <div>
            <p className="mb-3 border-t-2 border-accent pt-5 text-xs font-bold uppercase tracking-[0.1em] text-accent">Almost yours</p>
            <h1 className="mb-3 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em] text-cream">
              Checkout
            </h1>
            <p className="mb-10 max-w-md text-sm leading-relaxed text-muted">
              A few details and it&rsquo;s on its way — printed one at a time, just for you. <span className="font-bold text-cream">Secure Square checkout.</span>
            </p>

            {/* A wallet's whole point is that it already holds the address, so it must
                not sit behind six typed fields. This block initialises against the cart
                subtotal as soon as the SDK is up, uses the contact the wallet supplies,
                and re-prices server-side before charging (a mismatch fails safe back to
                this form). It reuses the Payments instance created above instead of
                booting a second one, and every failure path hands the shopper back to
                the form below rather than navigating to the page they are already on.
                It retires the moment a typed address yields a quote, because the wallets
                inside the Payment fieldset can then quote the exact final total. */}
            {sdkReady && !addressQuoted && (
              <ExpressCheckout
                squareConfig={squareConfig}
                paymentsApi={paymentsRef.current}
                onFallback={() => setError("We couldn't finish with your wallet — complete the details below and pay by card.")}
              />
            )}

            <form onSubmit={pay} noValidate>
            <fieldset className="mb-9 border-t border-border/40 pt-6" disabled={status === "paying"}>
              <legend className="mb-4 font-display text-xl font-bold uppercase tracking-[-0.03em] text-cream">Contact</legend>
              <label className={labelC} htmlFor="email">Email (for your receipt)</label>
              <input id="email" type="email" autoComplete="email" required className={field}
                value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@email.com" />
            </fieldset>

            <fieldset className="mb-9 border-t border-border/40 pt-6" disabled={status === "paying"}>
              <legend className="mb-4 font-display text-xl font-bold uppercase tracking-[-0.03em] text-cream">Shipping address</legend>
              <div className="grid gap-4">
                <div>
                  <label className={labelC} htmlFor="name">Full name</label>
                  <input id="name" autoComplete="name" required className={field}
                    value={contact.shippingName} onChange={(e) => setContact({ ...contact, shippingName: e.target.value })} />
                </div>
                <div>
                  <label className={labelC} htmlFor="addr">Address</label>
                  <input id="addr" autoComplete="address-line1" required className={field}
                    value={contact.address1} onChange={(e) => setContact({ ...contact, address1: e.target.value })} />
                </div>
                {/* Without this line a New York apartment order is undeliverable
                    and the parcel comes back to us at our cost. */}
                <div>
                  <label className={labelC} htmlFor="addr2">Apartment, suite, floor (optional)</label>
                  <input id="addr2" autoComplete="address-line2" className={field} placeholder="Apt 4B"
                    value={contact.address2} onChange={(e) => setContact({ ...contact, address2: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelC} htmlFor="city">City</label>
                    <input id="city" autoComplete="address-level2" required className={field}
                      value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelC} htmlFor="state">State{STATE_REQUIRED.has(contact.country) ? "" : " (optional)"}</label>
                    <input id="state" autoComplete="address-level1" className={field}
                      value={contact.state} onChange={(e) => setContact({ ...contact, state: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelC} htmlFor="zip">ZIP / Postal</label>
                    <input id="zip" autoComplete="postal-code" required className={field}
                      aria-describedby="zip-status" aria-invalid={postalVerdict.status === "blocked"}
                      value={contact.zip} onChange={(e) => setContact({ ...contact, zip: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelC} htmlFor="country">Country</label>
                    <select id="country" autoComplete="country" className={field}
                      value={contact.country} onChange={(e) => setContact({ ...contact, country: e.target.value })}>
                      {SHIPPING_COUNTRY_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Persistently mounted so the transition into an error is
                    actually announced — a live region that mounts with its text
                    is not. Blocking states also gate Pay via validate(). */}
                <div id="zip-status" aria-live="polite" className="min-h-4">
                  {postalVerdict.status === "blocked" && (
                    <>
                      <p className="font-body text-xs font-bold text-danger">{postalVerdict.message}</p>
                      {postalVerdict.suggestion && (
                        <button type="button"
                          onClick={() => setContact({ ...contact, city: postalVerdict.suggestion!.city, state: postalVerdict.suggestion!.state })}
                          className="mt-2 min-h-11 border border-border/60 px-3 text-[11px] font-bold uppercase tracking-wide text-cream hover:border-accent hover:text-accent">
                          Use {postalVerdict.suggestion.city}, {postalVerdict.suggestion.state}
                        </button>
                      )}
                    </>
                  )}
                  {postalVerdict.status === "ok" && postalVerdict.place && (
                    <p className="font-body text-xs font-bold text-success">
                      Confirmed — {postalVerdict.place.city}, {postalVerdict.place.state}.
                    </p>
                  )}
                  {/* Soft only. Our lookup misses APO/FPO, Puerto Rico, Samoa
                      and newer allocations, so this asks the shopper to look
                      twice and leaves the Pay button alone. */}
                  {postalNotFound && (
                    <p className="font-body text-xs text-muted">
                      We couldn&rsquo;t confirm {contact.zip.trim()} — give it a second look. If it&rsquo;s right, go ahead and pay.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="border-t border-border/40 pt-6" disabled={status === "paying"}>
              <legend className="mb-4 font-display text-xl font-bold uppercase tracking-[-0.03em] text-cream">Payment</legend>

              {/* Express wallets (shown only when the device/browser + Square support them).
                  These are quote-gated and therefore quote the exact tax-inclusive total,
                  so once they exist the subtotal-priced block at the top of the page is
                  already hidden — the shopper never sees two wallet controls. */}
              {(applePayReady || googlePayReady || afterpayReady || cashAppReady) && (
                <div className="mb-5">
                  <p className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Express checkout</p>
                  <div className="space-y-2">
                    {applePayReady && (
                      <button type="button" onClick={() => payWallet(applePayRef.current)} aria-label="Pay with Apple Pay"
                        className="min-h-12 w-full bg-white text-base font-bold uppercase tracking-[0.06em] text-black"> Apple Pay </button>
                    )}
                    {googlePayReady && (
                      <div id="aha-gpay" onClick={() => payWallet(googlePayRef.current)}
                        className="min-h-12 cursor-pointer overflow-hidden" />
                    )}
                    {/* Cash App Pay renders its own branded button here (event-based). */}
                    {cashAppReady && <div id="aha-cashapp" className="min-h-12 overflow-hidden" />}
                    {afterpayReady && (
                      <button type="button" onClick={() => payWallet(afterpayRef.current)} aria-label="Pay with Afterpay — 4 interest-free payments"
                        className="min-h-12 w-full bg-[#B2FCE4] text-sm font-bold uppercase tracking-[0.04em] text-black">
                        Pay in 4 with Afterpay
                      </button>
                    )}
                  </div>
                  <div className="my-4 flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <span className="h-px flex-1 bg-border/40" /> or pay with card <span className="h-px flex-1 bg-border/40" />
                  </div>
                </div>
              )}

              {/* Square Web Payments SDK mounts the secure card field here */}
              <div id="aha-card" className="min-h-[56px] border border-border/60 bg-void p-3" />

              {/* Gift-card redemption (gated). The field mounts when the flag is on;
                  the pay button appears once Square confirms gift cards are enabled. */}
              {process.env.NEXT_PUBLIC_GIFT_CARDS_ENABLED === "true" && (
                <div className="mt-4">
                  <p className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Or redeem a gift card</p>
                  <div id="aha-giftcard" className="min-h-[56px] border border-border/60 bg-void p-3" />
                  {giftCardReady && (
                    <button type="button" onClick={() => payWallet(giftCardRef.current)} className="btn-secondary mt-2 w-full justify-center">
                      Pay with gift card
                    </button>
                  )}
                </div>
              )}
              {!sdkReady && !sdkFailed && !error && (
                <p className="mt-2 font-body text-xs font-bold text-muted" aria-live="polite">Loading secure card field…</p>
              )}
              {!sdkReady && sdkFailed && (
                <div className="mt-2" aria-live="polite">
                  <p className="font-body text-xs font-bold text-danger">The secure card field is slow to load — likely your connection.</p>
                  <button type="button" onClick={() => window.location.reload()}
                    className="mt-2 min-h-11 border border-border/60 px-3 text-[11px] font-bold uppercase tracking-wide text-cream hover:border-accent hover:text-accent">
                    Reload to retry
                  </button>
                </div>
              )}
            </fieldset>

            <p className="mt-4 min-h-4 font-body text-xs font-bold text-muted" aria-live="polite">
              {quoteAnnouncement}
            </p>
            {quoteError && (
              <div role="alert" className="mt-4 border border-danger bg-surface px-4 py-3">
                <p className="text-sm font-bold text-danger">{quoteError}</p>
                <button type="button" onClick={() => { void loadQuote(); }}
                  className="mt-2 min-h-11 border border-border/60 px-3 text-[11px] font-bold uppercase tracking-wide text-cream hover:border-accent hover:text-accent">
                  Retry final total
                </button>
              </div>
            )}

            {error && (
              <p role="alert" aria-live="assertive" className="mt-4 border border-danger bg-surface px-4 py-3 text-sm font-bold text-danger">
                {error}
              </p>
            )}

            {slowPay && status === "paying" && (
              <p aria-live="polite" className="mt-4 border border-border/60 bg-surface px-4 py-3 text-sm font-bold text-cream">
                Still working — your connection looks slow. Please don&rsquo;t close this tab or tap Pay again; we&rsquo;ll confirm as soon as it goes through.
              </p>
            )}

            <button
              type="submit"
              aria-disabled={payBlocked}
              className={`primary-action mt-6 min-h-14 w-full px-5 py-5 text-base ${payBlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span className="relative z-10">
                {status === "paying"
                  ? (slowPay ? "Still working…" : "Processing…")
                  : !sdkReady
                    ? (sdkFailed ? "Card field unavailable — reload above" : "Loading secure card…")
                    : quote
                      ? `Pay ${money(quote.total)}`
                      : "Enter shipping address for final total"}
              </span>
            </button>
            <p className="mt-3 font-body text-xs font-bold leading-relaxed text-muted">
              Secured by Square. Card details are handled by Square and do not pass through our servers. {SHIPPING_CLAIM_SENTENCE} Your exact shipping and tax are confirmed before payment.
            </p>
            </form>
          </div>

          {/* Order summary */}
          <aside className="h-fit border-t-2 border-accent pt-5 lg:sticky lg:top-28">
            <h2 className="mb-4 font-display text-2xl font-black uppercase leading-none tracking-[-0.04em] text-cream">Order</h2>
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={`${i.variationId}`} className="flex justify-between gap-3 font-body text-sm font-bold text-cream">
                  <span>{i.name} <span className="text-muted">/ {i.variationName} × {i.quantity}</span></span>
                  <span>{money(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-border/40 pt-4">
              <label htmlFor="promo" className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Promo code</label>
              <div className="mt-2 flex gap-2">
                <input id="promo" value={promoCode} autoComplete="off"
                  onChange={(e) => { setPromoCode(e.target.value); setPromoInvalid(false); }}
                  placeholder="Enter code"
                  className="min-h-11 flex-1 border border-border/60 bg-void px-3 text-base uppercase text-cream placeholder:normal-case placeholder:text-muted" />
                <button type="button" onClick={() => setAppliedPromo(promoCode.trim())}
                  disabled={!promoCode.trim() || quoteStatus === "loading" || promoCode.trim().toUpperCase() === appliedPromo.toUpperCase()}
                  className="btn-secondary min-h-11 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">Apply</button>
              </div>
              {promoInfo && <p className="mt-2 text-xs font-bold text-success">{promoInfo.label} applied{promoInfo.percentage ? ` — ${promoInfo.percentage}% off` : ""}.</p>}
              {promoInvalid && <p className="mt-2 text-xs font-bold text-warning">That code isn&rsquo;t valid.</p>}
            </div>

            <div className="mt-5 space-y-2 border-t border-border/40 pt-4 text-sm font-bold">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(total)}</span></div>
              {/* quote.subtotal is Square's total minus tax, so it carries the international
                  shipping charge. Back it out before deriving the promo amount, or the
                  discount line silently disappears on international orders. */}
              {promoInfo && quote && total - (quote.subtotal - shippingCents) > 0 && (
                <div className="flex justify-between text-success"><span>{promoInfo.label}{promoInfo.percentage ? ` (${promoInfo.percentage}% off)` : ""}</span><span>-{money(total - (quote.subtotal - shippingCents))}</span></div>
              )}
              <div className="flex justify-between text-muted"><span>Shipping</span>{shippingCents > 0 ? <span>{money(shippingCents)}</span> : <span className="text-success">Free</span>}</div>
              <div className="flex justify-between text-muted">
                <span>Tax</span>
                <span>{quote ? money(quote.tax) : "Calculated from address"}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-border/40 pt-3 text-lg text-cream"><span>Total</span><span>{quote ? money(quote.total) : "Pending"}</span></div>
            </div>
            {/* The itinerary — like a plane ticket, it makes the wait feel like a
                journey and reinforces the made-to-order story at peak intent. */}
            <div className="mt-7 border-t border-border/40 pt-5">
              <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Your order&rsquo;s journey</p>
              <ol aria-label="What happens after you pay">
                {JOURNEY_STEPS.map((step, i) => (
                  <li key={step.label} className="flex gap-3 pb-4 last:pb-0">
                    <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-[10px] font-bold text-accent">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.05em] text-cream">{step.label}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
