"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import type { SquareWebPaymentsConfig } from "@/lib/commerce/runtime";

type TokenResult = { status: string; token: string };
type SquareCard = { attach: (selector: string) => Promise<void>; tokenize: () => Promise<TokenResult> };
type SquareWallet = { attach?: (selector: string, opts?: unknown) => Promise<void>; tokenize: () => Promise<TokenResult> };
type SquarePaymentRequest = unknown;
type SquarePaymentsApi = {
  card: () => Promise<SquareCard>;
  paymentRequest: (req: unknown) => SquarePaymentRequest;
  applePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
  googlePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
};
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePaymentsApi };
  }
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const STATE_REQUIRED = new Set(["US", "CA", "AU"]);

interface Props {
  squareConfig: SquareWebPaymentsConfig;
}

export function CheckoutForm({ squareConfig }: Props) {
  const { items, total, clearCart } = useCart();
  const router = useRouter();

  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "paying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
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

      // Wallets — init defensively. Apple Pay needs a registered merchant domain in Square; if that
      // isn't set up (or the device/browser doesn't support a wallet), init throws and we just hide it.
      try {
        const req = payments.paymentRequest({
          countryCode: "US",
          currencyCode: "USD",
          total: { amount: (total / 100).toFixed(2), label: "After Hours Agenda" },
        });
        try {
          applePayRef.current = await payments.applePay(req);
          setApplePayReady(true);
        } catch { /* Apple Pay unavailable */ }
        try {
          const gp = await payments.googlePay(req);
          await gp.attach?.("#aha-gpay", { buttonColor: "white", buttonType: "long", buttonSizeMode: "fill" });
          googlePayRef.current = gp;
          setGooglePayReady(true);
        } catch { /* Google Pay unavailable */ }
      } catch { /* paymentRequest unavailable */ }
    } catch {
      setError("Could not load the secure card field. Refresh and try again.");
    }
    // total is fixed for the life of this checkout page (cart doesn't change here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareConfig.applicationId, squareConfig.locationId]);

  useEffect(() => {
    if (window.Square) initSquare();
  }, [initSquare]);

  const validate = (): string | null => {
    if (!contact.email || !/.+@.+\..+/.test(contact.email)) return "Enter a valid email for your receipt.";
    if (!contact.shippingName) return "Enter the name for shipping.";
    if (!contact.address1 || !contact.city || !contact.zip) return "Complete your shipping address.";
    if (STATE_REQUIRED.has(contact.country) && !contact.state) return "State/province is required.";
    return null;
  };

  // Shared charge path for card + wallet tokens.
  const submitWithToken = async (token: string) => {
    setStatus("paying");
    setError(null);
    try {
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: token,
          idempotencyKey: idempotencyKeyRef.current,
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
        // Definitive decline/validation → rotate the key so a corrected retry is a fresh attempt.
        idempotencyKeyRef.current = crypto.randomUUID();
        setStatus("error");
        setError(data.error || "We couldn't complete the payment. Your card was not charged.");
        return;
      }
      clearCart();
      router.push(`/order-confirmed?order=${encodeURIComponent(data.orderNumber)}`);
    } catch {
      // Unknown outcome (network) — KEEP the key so a retry is deduped server-side, not double-charged.
      setStatus("error");
      setError("Connection dropped. Tap Pay again — you won't be charged twice.");
    }
  };

  const pay = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (status === "paying") return;
    setError(null);
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    if (!cardRef.current) { setError("Payment field is still loading."); return; }
    const t = await cardRef.current.tokenize();
    if (t.status !== "OK") { setError("Please check your card details and try again."); return; }
    await submitWithToken(t.token);
  };

  const payWallet = async (wallet: SquareWallet | null) => {
    if (!wallet || status === "paying") return;
    setError(null);
    const invalid = validate();
    if (invalid) { setError(`${invalid} It's needed to ship your order.`); return; }
    try {
      const t = await wallet.tokenize();
      if (t.status !== "OK") return; // shopper dismissed the wallet sheet
      await submitWithToken(t.token);
    } catch {
      setError("Wallet payment didn't complete. Try again or use a card.");
    }
  };

  const field = "w-full border-[3px] border-[#E9E1D4] bg-[#15110F] px-3 py-3 font-body text-base font-bold text-cream placeholder:text-muted focus:border-[#00FFFF] focus:outline-none";
  const labelC = "mb-1 block font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted";

  if (items.length === 0) {
    return (
      <div className="px-4 pb-24 pt-32 md:px-6">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-4xl font-black uppercase tracking-[-0.05em] text-cream">Your bag is empty</h1>
          <p className="mt-3 font-body text-sm font-bold text-muted">Nothing to check out yet.</p>
          <Link href="/shop" className="mt-6 inline-block metrocard-gradient px-6 py-4 font-body text-sm font-bold uppercase tracking-[0.08em]">
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
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_360px]">
          {/* Form */}
          <div>
            <h1 className="mb-8 font-display text-[clamp(2.5rem,6vw,4rem)] font-black uppercase leading-[0.85] tracking-[-0.06em] text-cream">
              Checkout
            </h1>

            <form onSubmit={pay} noValidate>
            <fieldset className="mb-8" disabled={status === "paying"}>
              <legend className="mb-3 font-display text-xl font-black uppercase tracking-[-0.03em] text-cream">Contact</legend>
              <label className={labelC} htmlFor="email">Email (for your receipt)</label>
              <input id="email" type="email" autoComplete="email" required className={field}
                value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@email.com" />
            </fieldset>

            <fieldset className="mb-8" disabled={status === "paying"}>
              <legend className="mb-3 font-display text-xl font-black uppercase tracking-[-0.03em] text-cream">Ship to</legend>
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

            <fieldset disabled={status === "paying"}>
              <legend className="mb-3 font-display text-xl font-black uppercase tracking-[-0.03em] text-cream">Payment</legend>

              {/* Express wallets (shown only when the device/browser + Square support them) */}
              {(applePayReady || googlePayReady) && (
                <div className="mb-5">
                  <p className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Express checkout</p>
                  <div className="space-y-2">
                    {applePayReady && (
                      <button type="button" onClick={() => payWallet(applePayRef.current)} aria-label="Pay with Apple Pay"
                        className="min-h-12 w-full bg-white font-body text-base font-bold uppercase tracking-[0.06em] text-black transition-transform hover:-translate-y-0.5"> Apple Pay </button>
                    )}
                    {googlePayReady && (
                      <div id="aha-gpay" role="button" aria-label="Pay with Google Pay" onClick={() => payWallet(googlePayRef.current)}
                        className="min-h-12 cursor-pointer overflow-hidden" />
                    )}
                  </div>
                  <div className="my-4 flex items-center gap-3 font-body text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                    <span className="h-px flex-1 bg-[#E9E1D4]/30" /> or pay with card <span className="h-px flex-1 bg-[#E9E1D4]/30" />
                  </div>
                </div>
              )}

              {/* Square Web Payments SDK mounts the secure card field here */}
              <div id="aha-card" className="min-h-[56px] border-[3px] border-[#E9E1D4] bg-[#15110F] p-3" />
              {!sdkReady && !error && (
                <p className="mt-2 font-body text-xs font-bold text-muted" aria-live="polite">Loading secure card field…</p>
              )}
            </fieldset>

            {error && (
              <p role="alert" aria-live="assertive" className="mt-4 border-[3px] border-[#FF006E] bg-[#15110F] px-4 py-3 font-body text-sm font-bold text-[#FFAA00]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "paying"}
              className={`mt-6 w-full metrocard-gradient py-5 font-body text-base font-bold uppercase tracking-[0.08em] transition-all ${status === "paying" ? "cursor-wait opacity-70" : "cursor-pointer"}`}
            >
              <span className="relative z-10">{status === "paying" ? "Processing…" : `Pay ${money(total)}`}</span>
            </button>
            <p className="mt-3 font-body text-xs font-bold leading-relaxed text-muted">
              Secured by Square — your card details never touch our servers. Free shipping, and the price you see is the price you pay.
            </p>
            </form>
          </div>

          {/* Order summary */}
          <aside className="zine-block h-fit p-5">
            <h2 className="mb-4 font-display text-2xl font-black uppercase leading-none tracking-[-0.04em] text-cream">Order</h2>
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={`${i.variationId}`} className="flex justify-between gap-3 font-body text-sm font-bold text-cream">
                  <span>{i.name} <span className="text-muted">/ {i.variationName} × {i.quantity}</span></span>
                  <span>{money(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t-[3px] border-[#E9E1D4]/30 pt-4 font-body text-sm font-bold">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(total)}</span></div>
              <div className="flex justify-between text-muted"><span>Shipping</span><span className="text-[#CCFF00]">Free</span></div>
              <div className="mt-2 flex justify-between text-lg text-cream"><span>Total</span><span>{money(total)}</span></div>
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
