"use client";

import { useCallback, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import type { SquareWebPaymentsConfig } from "@/lib/commerce/runtime";
import { extractExpressContact, expressTotalAmount, isExpressCheckoutEnabled } from "@/lib/checkout/express";

type TokenResult = { status: string; token?: string; details?: unknown };
type SquareWallet = { attach?: (selector: string, opts?: unknown) => Promise<void>; tokenize: () => Promise<TokenResult> };
interface SquarePaymentRequest { [k: string]: unknown }
interface SquarePaymentsApi {
  paymentRequest: (req: unknown) => SquarePaymentRequest;
  applePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
  googlePay: (req: SquarePaymentRequest) => Promise<SquareWallet>;
}
const squareGlobal = () => (typeof window === "undefined" ? undefined : (window as unknown as { Square?: { payments: (appId: string, locationId: string) => SquarePaymentsApi } }).Square);

interface Line { squareVariationId: string; quantity: number }
interface ItemSnapshot { name: string; variationName: string; quantity: number; productId: string; slug: string; variationId: string; price: number; priceFormatted: string; image: string }

/**
 * PDP express checkout — Apple/Google Pay for the single selected variation.
 *
 * Honors the doctrine "Square SDK loads only on checkout/payment": the heavy SDK
 * is NOT loaded on product-page view. It ARMS (loads the SDK + inits wallets)
 * only on the shopper's purchase intent — hover / focus / tap of the express
 * affordance — then reveals the wallet buttons.
 *
 * FAIL-SAFE, identical to the cart express: any missing wallet data, price
 * mismatch (QUOTE_CHANGED), decline, or error routes to the normal, fully-tested
 * /checkout instead of charging — it can never strand a shopper or charge wrong.
 * Pricing + charge reuse the same /api/checkout-quote and /api/create-payment.
 */
export function PdpExpressCheckout({ squareConfig, line, subtotalCents, itemSnapshot, disabled }: {
  squareConfig: SquareWebPaymentsConfig;
  line: Line;
  subtotalCents: number;
  itemSnapshot: ItemSnapshot;
  disabled?: boolean;
}) {
  const router = useRouter();
  const paymentsRef = useRef<SquarePaymentsApi | null>(null);
  const applePayRef = useRef<SquareWallet | null>(null);
  const googlePayRef = useRef<SquareWallet | null>(null);
  const idempotencyKeyRef = useRef<string>("");
  const [armed, setArmed] = useState(false);
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const enabled = isExpressCheckoutEnabled();
  const canRender = enabled && Boolean(squareConfig.applicationId && squareConfig.locationId) && !disabled;

  if (!idempotencyKeyRef.current && typeof crypto !== "undefined") idempotencyKeyRef.current = crypto.randomUUID();

  // Arm on intent — this is the ONLY thing that triggers the SDK load.
  const arm = useCallback(() => { if (canRender) setArmed(true); }, [canRender]);

  const initWallets = useCallback(async () => {
    if (paymentsRef.current || !canRender) return;
    const Square = squareGlobal();
    if (!Square) return;
    try {
      const payments = Square.payments(squareConfig.applicationId, squareConfig.locationId);
      paymentsRef.current = payments;
      const request = payments.paymentRequest({
        countryCode: "US",
        currencyCode: "USD",
        // Preliminary total (item subtotal). The authoritative discounted/taxed
        // total is recomputed server-side before charging; a mismatch fails safe.
        total: { amount: expressTotalAmount(subtotalCents), label: "After Hours Agenda" },
        requestShippingContact: true,
        requestBillingContact: true,
      });
      try { applePayRef.current = await payments.applePay(request); setApplePayReady(true); } catch { /* Apple Pay unavailable on this device/domain */ }
      try {
        const googlePay = await payments.googlePay(request);
        googlePayRef.current = googlePay;
        await googlePay.attach?.("#aha-pdp-gpay", { buttonColor: "black", buttonType: "buy", buttonSizeMode: "fill" });
        setGooglePayReady(true);
      } catch { /* Google Pay unavailable on this device */ }
    } catch { /* SDK init failed — express simply won't appear; Add-to-bag path unaffected */ }
  }, [squareConfig, subtotalCents, canRender]);

  const toCheckout = () => router.push("/checkout");

  const payWithWallet = async (wallet: SquareWallet | null) => {
    if (!wallet || busy) return;
    setBusy(true);
    try {
      const t = await wallet.tokenize();
      if (t.status !== "OK" || !t.token) { setBusy(false); return; } // shopper dismissed the sheet

      const contact = extractExpressContact(t.details);
      if (!contact) { toCheckout(); return; } // no usable address → finish on the form

      const lines = [line];

      const quoteRes = await fetch("/api/checkout-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, contact }),
      });
      const quoteData = await quoteRes.json().catch(() => null);
      if (!quoteRes.ok || !quoteData?.ok || !quoteData.quote) { toCheckout(); return; }
      const quote = quoteData.quote as { total: number; currency: string; subtotal: number };

      const payRes = await fetch("/api/create-payment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: t.token,
          idempotencyKey: idempotencyKeyRef.current,
          quotedTotal: quote.total,
          quotedCurrency: quote.currency,
          lines,
          contact,
        }),
      });
      const payData = await payRes.json().catch(() => null);
      if (!payRes.ok || !payData?.ok) { toCheckout(); return; } // QUOTE_CHANGED / decline / error → normal checkout

      sessionStorage.setItem("aha-last-order", JSON.stringify({
        orderNumber: payData.orderNumber,
        receiptUrl: typeof payData.receiptUrl === "string" ? payData.receiptUrl : null,
        items: [{ ...itemSnapshot, lineTotal: itemSnapshot.price * itemSnapshot.quantity }],
        subtotal: subtotalCents,
        discount: Math.max(0, subtotalCents - quote.subtotal),
        total: quote.total,
        currency: quote.currency,
        shippingName: contact.shippingName,
        shippingAddress: contact.shippingAddress,
      }));
      router.push(`/order-confirmed?order=${encodeURIComponent(payData.orderNumber)}`);
    } catch {
      toCheckout(); // any unexpected error → the proven path
    }
  };

  if (!canRender) return null;

  return (
    <div className="mt-3">
      {!armed ? (
        // Intent-scoped: arming here is what loads the Square SDK, never on view.
        <button
          type="button"
          onClick={arm}
          onPointerEnter={arm}
          onFocus={arm}
          className="btn-secondary w-full justify-center"
        >
          Express pay — Apple Pay / Google Pay
        </button>
      ) : (
        <>
          <Script src={squareConfig.sdkUrl} strategy="afterInteractive" onLoad={() => void initWallets()} />
          {applePayReady || googlePayReady ? (
            <div>
              <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Express checkout</p>
              <div className="flex flex-col gap-2">
                {applePayReady && (
                  <button type="button" onClick={() => void payWithWallet(applePayRef.current)} disabled={busy} aria-label="Buy now with Apple Pay" className="min-h-12 w-full bg-cream text-void disabled:opacity-60">
                    <span className="text-sm font-bold"> Pay</span>
                  </button>
                )}
                <div id="aha-pdp-gpay" onClick={() => void payWithWallet(googlePayRef.current)} className={googlePayReady ? "min-h-12 w-full" : "hidden"} />
              </div>
              <p className="mt-2 text-center text-[10px] leading-snug text-muted">Uses the address from your wallet. If anything&rsquo;s missing you&rsquo;ll finish on the secure checkout page.</p>
            </div>
          ) : (
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.08em] text-muted" aria-live="polite">Loading express checkout&hellip;</p>
          )}
        </>
      )}
    </div>
  );
}
