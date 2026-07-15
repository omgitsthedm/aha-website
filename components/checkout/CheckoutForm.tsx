"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import type { SquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { trackCommerceEvent } from "@/lib/analytics/events";

type TokenResult = { status: string; token: string };
type SquareCard = { attach: (selector: string) => Promise<void>; tokenize: () => Promise<TokenResult> };
type SquareWallet = { attach?: (selector: string, opts?: unknown) => Promise<void>; tokenize: () => Promise<TokenResult> };
type SquarePaymentRequest = unknown;
type VerificationResult = { token?: string };
type SquarePaymentsApi = {
  card: () => Promise<SquareCard>;
  paymentRequest: (req: unknown) => SquarePaymentRequest;
  applePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
  googlePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
  verifyBuyer?: (token: string, details: unknown) => Promise<VerificationResult>;
};
interface CheckoutQuote {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}
interface ShippingContact {
  email: string;
  shippingName: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePaymentsApi };
  }
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const STATE_REQUIRED = new Set(["US", "CA", "AU"]);

// The "boarding pass" itinerary — like a plane ticket, it turns a form into a
// journey, building anticipation and answering "when do I get it?" before the
// shopper has to ask. Reinforces the made-to-order brand story at the moment of
// highest intent.
const JOURNEY_STEPS = [
  { label: "Order placed", detail: "Confirmed instantly, receipt to your inbox." },
  { label: "Printed in New York", detail: "Made to order just for you — 2 to 5 business days." },
  { label: "Shipped free", detail: "Tracking lands the moment it leaves the shop." },
  { label: "Yours to wear", detail: "Made after hours. Worn all day." },
];

function getAddressError(contact: ShippingContact): string | null {
  if (!contact.shippingName) return "Enter the name for shipping.";
  if (!contact.address1 || !contact.city || !contact.zip) return "Complete your shipping address.";
  if (STATE_REQUIRED.has(contact.country) && !contact.state) return "State/province is required.";
  return null;
}

interface Props {
  squareConfig: SquareWebPaymentsConfig;
}

export function CheckoutForm({ squareConfig }: Props) {
  const { items, total, clearCart } = useCart();
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
  const [contact, setContact] = useState({
    email: "", shippingName: "", address1: "", city: "", state: "", zip: "", country: "US",
  });

  const paymentsRef = useRef<SquarePaymentsApi | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const applePayRef = useRef<SquareWallet | null>(null);
  const googlePayRef = useRef<SquareWallet | null>(null);
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
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
    } catch {
      setError("Could not load the secure card field. Refresh and try again.");
    }
  }, [squareConfig.applicationId, squareConfig.locationId]);

  useEffect(() => {
    if (window.Square) initSquare();
  }, [initSquare]);

  // Watchdog: on a slow/blocked connection the Square SDK script can stall. If
  // the secure card field still isn't ready after 10s, surface a reload path
  // instead of a permanently disabled button.
  useEffect(() => {
    if (sdkReady) { setSdkFailed(false); return; }
    const t = window.setTimeout(() => { if (!sdkReady) setSdkFailed(true); }, 10_000);
    return () => window.clearTimeout(t);
  }, [sdkReady]);

  // Restore a previously-typed address so a mid-checkout connection drop or
  // reload doesn't wipe the form. Card data is NEVER stored (Square holds it).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aha-checkout-contact");
      if (saved) setContact((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch { /* private mode / bad JSON — start fresh */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("aha-checkout-contact", JSON.stringify(contact)); } catch { /* ignore */ }
  }, [contact]);

  // Keyless ZIP → city/state autofill: one friction cut Shopify gets from
  // address autocomplete. Fills ONLY empty fields, is fully non-blocking, and
  // never touches the charge — a failure (offline / 404 / CSP) silently no-ops
  // and manual entry is unaffected. Full-street autocomplete (Google Places)
  // is a follow-up gated on an API key.
  useEffect(() => {
    const zip = contact.zip.trim();
    const country = contact.country.toLowerCase();
    if (zip.length < 4) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`https://api.zippopotam.us/${country}/${encodeURIComponent(zip)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const place = Array.isArray(data?.places) ? data.places[0] : null;
        if (!place) return;
        const city = place["place name"];
        const state = place["state abbreviation"] || place["state"];
        setContact((prev) => ({
          ...prev,
          city: prev.city.trim() ? prev.city : (city || prev.city),
          state: prev.state.trim() ? prev.state : (state || prev.state),
        }));
      } catch { /* offline / 404 / CSP — silently skip */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [contact.zip, contact.country]);

  useEffect(() => {
    if (items.length > 0) {
      trackCommerceEvent({ name: "begin_checkout", valueCents: total, currency: "USD", quantity: items.reduce((sum, item) => sum + item.quantity, 0) });
    }
  }, [items, total]);

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
          address1: contact.address1, city: contact.city, state: contact.state,
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
    applePayRef.current = null;
    googlePayRef.current = null;
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
      } catch { /* paymentRequest unavailable */ }
    };
    void initWallets();
    return () => { cancelled = true; };
  }, [quote, contact.country, sdkReady]);

  useEffect(() => {
    if (!googlePayReady || !googlePayRef.current?.attach) return;
    void googlePayRef.current.attach("#aha-gpay", {
      buttonColor: "white", buttonType: "long", buttonSizeMode: "fill",
    }).catch(() => setGooglePayReady(false));
  }, [googlePayReady]);

  const validate = (): string | null => {
    if (!contact.email || !/.+@.+\..+/.test(contact.email)) return "Enter a valid email for your receipt.";
    return getAddressError(contact);
  };

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
              address1: contact.address1, city: contact.city, state: contact.state,
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
        // Only a definitive payment decline consumes this payment attempt. Quote/cart validation
        // never reached the Payments API, so keep the stable key.
        if (res.status === 402) idempotencyKeyRef.current = crypto.randomUUID();
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
        })),
        subtotal: total, // gross pre-discount
        discount: Math.max(0, total - reviewedQuote.subtotal),
        total: reviewedQuote.total,
        currency: reviewedQuote.currency,
        shippingName: contact.shippingName,
        shippingAddress: {
          address1: contact.address1,
          city: contact.city,
          state: contact.state,
          zip: contact.zip,
          country: contact.country,
        },
      }));
      clearCart();
      try { localStorage.removeItem("aha-checkout-contact"); } catch { /* ignore */ }
      router.push(`/order-confirmed?order=${encodeURIComponent(data.orderNumber)}`);
    } catch {
      // Keep the key after an unknown network outcome so a retry is deduped server-side.
      window.clearTimeout(slowTimer);
      setSlowPay(false);
      setStatus("error");
      setError("Connection dropped. Tap Pay again. The retry uses the same payment key to prevent a duplicate charge.");
    }
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
            addressLines: [contact.address1],
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

  if (items.length === 0) {
    return (
      <div className="px-4 pb-24 pt-32 md:px-6">
        <div className="mx-auto max-w-md border-t-2 border-accent pt-6 text-left">
          <h1 className="font-display text-4xl font-black uppercase tracking-[-0.05em] text-cream">Your bag is empty</h1>
          <p className="mt-3 text-sm text-muted">Nothing to check out yet.</p>
          <Link href="/shop" className="primary-action mt-6 inline-block min-h-12 px-6 py-4 text-sm">
            Shop the catalog
          </Link>
        </div>
      </div>
    );
  }

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
                      value={contact.zip} onChange={(e) => setContact({ ...contact, zip: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelC} htmlFor="country">Country</label>
                    <select id="country" autoComplete="country" className={field}
                      value={contact.country} onChange={(e) => setContact({ ...contact, country: e.target.value })}>
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                    </select>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="border-t border-border/40 pt-6" disabled={status === "paying"}>
              <legend className="mb-4 font-display text-xl font-bold uppercase tracking-[-0.03em] text-cream">Payment</legend>

              {/* Express wallets (shown only when the device/browser + Square support them) */}
              {(applePayReady || googlePayReady) && (
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
                  </div>
                  <div className="my-4 flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <span className="h-px flex-1 bg-border/40" /> or pay with card <span className="h-px flex-1 bg-border/40" />
                  </div>
                </div>
              )}

              {/* Square Web Payments SDK mounts the secure card field here */}
              <div id="aha-card" className="min-h-[56px] border border-border/60 bg-void p-3" />
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

            {quoteStatus === "loading" && (
              <p className="mt-4 font-body text-xs font-bold text-muted" aria-live="polite">
                Calculating tax and final total…
              </p>
            )}
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
              disabled={status === "paying" || quoteStatus !== "ready" || !sdkReady}
              className={`primary-action mt-6 min-h-14 w-full px-5 py-5 text-base ${status === "paying" || quoteStatus !== "ready" || !sdkReady ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
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
              Secured by Square. Card details are handled by Square and do not pass through our servers. Free shipping and tax are confirmed before payment.
            </p>
            </form>
          </div>

          {/* Order summary */}
          <aside className="h-fit border-t-2 border-accent pt-5 lg:sticky lg:top-28">
            {/* Envision it: a lifestyle moment at the point of highest intent —
                the shopper pictures themselves wearing it, not filling a form. */}
            <div className="relative mb-6 aspect-[16/10] overflow-hidden">
              <Image src="/campaign/lifestyle/band.webp" alt="After Hours Agenda, worn on the streets of New York" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 360px" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF8DA1]">You&rsquo;re almost wearing it</p>
                <p className="mt-1 font-display text-lg font-bold uppercase leading-[0.95] tracking-[-0.03em] text-white">Made after hours. Worn all day.</p>
              </div>
            </div>
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
                  className="min-h-11 flex-1 border border-border/60 bg-void px-3 text-sm uppercase text-cream placeholder:normal-case placeholder:text-muted" />
                <button type="button" onClick={() => setAppliedPromo(promoCode.trim())}
                  disabled={!promoCode.trim() || quoteStatus === "loading" || promoCode.trim().toUpperCase() === appliedPromo.toUpperCase()}
                  className="btn-secondary min-h-11 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">Apply</button>
              </div>
              {promoInfo && <p className="mt-2 text-xs font-bold text-success">{promoInfo.label} applied{promoInfo.percentage ? ` — ${promoInfo.percentage}% off` : ""}.</p>}
              {promoInvalid && <p className="mt-2 text-xs font-bold text-warning">That code isn&rsquo;t valid.</p>}
            </div>

            <div className="mt-5 space-y-2 border-t border-border/40 pt-4 text-sm font-bold">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(total)}</span></div>
              {promoInfo && quote && total - quote.subtotal > 0 && (
                <div className="flex justify-between text-success"><span>{promoInfo.label}{promoInfo.percentage ? ` (${promoInfo.percentage}% off)` : ""}</span><span>-{money(total - quote.subtotal)}</span></div>
              )}
              <div className="flex justify-between text-muted"><span>Shipping</span><span className="text-success">Free</span></div>
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
