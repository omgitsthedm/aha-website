"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
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
  const [status, setStatus] = useState<"idle" | "paying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [quoteError, setQuoteError] = useState<string | null>(null);
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

  useEffect(() => {
    if (items.length > 0) {
      trackCommerceEvent({ name: "begin_checkout", valueCents: total, currency: "USD", quantity: items.reduce((sum, item) => sum + item.quantity, 0) });
    }
  }, [items, total]);

  const loadQuote = useCallback(async () => {
    if (getAddressError(contact)) return null;
    setQuoteStatus("loading");
    setQuoteError(null);
    try {
      const response = await fetch("/api/checkout-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: items.map((item) => ({ squareVariationId: item.variationId, quantity: item.quantity })),
          contact: {
            shippingName: contact.shippingName,
            shippingAddress: {
              address1: contact.address1, city: contact.city, state: contact.state,
              zip: contact.zip, country: contact.country,
            },
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Final pricing is unavailable.");
      setQuote(data.quote);
      setQuoteStatus("ready");
      return data.quote as CheckoutQuote;
    } catch (quoteFailure) {
      setQuote(null);
      setQuoteStatus("error");
      setQuoteError(quoteFailure instanceof Error ? quoteFailure.message : "Final pricing is unavailable.");
      return null;
    }
  }, [items, contact]);

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
    try {
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: token,
          idempotencyKey: idempotencyKeyRef.current,
          quotedTotal: reviewedQuote.total,
          quotedCurrency: reviewedQuote.currency,
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
        setStatus("error");
        setError(data.error || "We couldn't complete the payment. Your card was not charged.");
        return;
      }
      sessionStorage.setItem("aha-last-order", JSON.stringify({
        orderNumber: data.orderNumber,
        receiptUrl: typeof data.receiptUrl === "string" ? data.receiptUrl : null,
        items: items.map((item) => ({
          name: item.name,
          variationName: item.variationName,
          quantity: item.quantity,
          lineTotal: item.price * item.quantity,
        })),
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
      router.push(`/order-confirmed?order=${encodeURIComponent(data.orderNumber)}`);
    } catch {
      // Keep the key after an unknown network outcome so a retry is deduped server-side.
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
            <p className="mb-3 border-t-2 border-accent pt-5 text-xs font-bold uppercase tracking-[0.1em] text-accent">Secure Square payment</p>
            <h1 className="mb-10 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-black uppercase leading-[0.86] tracking-[-0.06em] text-cream">
              Checkout
            </h1>

            <form onSubmit={pay} noValidate>
            <fieldset className="mb-9 border-t border-border/40 pt-6" disabled={status === "paying"}>
              <legend className="mb-4 font-display text-xl font-black uppercase tracking-[-0.03em] text-cream">01 / Contact</legend>
              <label className={labelC} htmlFor="email">Email (for your receipt)</label>
              <input id="email" type="email" autoComplete="email" required className={field}
                value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@email.com" />
            </fieldset>

            <fieldset className="mb-9 border-t border-border/40 pt-6" disabled={status === "paying"}>
              <legend className="mb-4 font-display text-xl font-black uppercase tracking-[-0.03em] text-cream">02 / Ship to</legend>
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
              <legend className="mb-4 font-display text-xl font-black uppercase tracking-[-0.03em] text-cream">03 / Payment</legend>

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
              {!sdkReady && !error && (
                <p className="mt-2 font-body text-xs font-bold text-muted" aria-live="polite">Loading secure card field…</p>
              )}
            </fieldset>

            {quoteStatus === "loading" && (
              <p className="mt-4 font-body text-xs font-bold text-muted" aria-live="polite">
                Calculating tax and final total…
              </p>
            )}
            {quoteError && (
              <p role="alert" className="mt-4 border border-danger bg-surface px-4 py-3 text-sm font-bold text-danger">
                {quoteError}
              </p>
            )}

            {error && (
              <p role="alert" aria-live="assertive" className="mt-4 border border-danger bg-surface px-4 py-3 text-sm font-bold text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "paying" || quoteStatus !== "ready" || !sdkReady}
              className={`primary-action mt-6 min-h-14 w-full px-5 py-5 text-base ${status === "paying" || quoteStatus !== "ready" || !sdkReady ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span className="relative z-10">
                {status === "paying"
                  ? "Processing…"
                  : !sdkReady
                    ? "Card payment unavailable"
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
            <h2 className="mb-4 font-display text-2xl font-black uppercase leading-none tracking-[-0.04em] text-cream">Order</h2>
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={`${i.variationId}`} className="flex justify-between gap-3 font-body text-sm font-bold text-cream">
                  <span>{i.name} <span className="text-muted">/ {i.variationName} × {i.quantity}</span></span>
                  <span>{money(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-2 border-t border-border/40 pt-4 text-sm font-bold">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(quote?.subtotal ?? total)}</span></div>
              <div className="flex justify-between text-muted"><span>Shipping</span><span className="text-success">Free</span></div>
              <div className="flex justify-between text-muted">
                <span>Tax</span>
                <span>{quote ? money(quote.tax) : "Calculated from address"}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-border/40 pt-3 text-lg text-cream"><span>Total</span><span>{quote ? money(quote.total) : "Pending"}</span></div>
            </div>
            <p className="mt-4 font-body text-[11px] font-bold leading-relaxed text-muted">
              Made to order. Delivery includes production time plus carrier transit.
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
