"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
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
// Access window.Square via a local cast so we don't re-declare the global that
// CheckoutForm already owns (avoids conflicting Window augmentations).
const squareGlobal = () => (typeof window === "undefined" ? undefined : (window as unknown as { Square?: { payments: (appId: string, locationId: string) => SquarePaymentsApi } }).Square);

/**
 * Express one-tap checkout with Apple Pay / Google Pay, straight from the bag.
 * GATED (NEXT_PUBLIC_EXPRESS_CHECKOUT_ENABLED) and FAIL-SAFE: on any missing
 * wallet data, price mismatch, or error, it routes the shopper to the normal,
 * fully-tested /checkout instead of charging — so it can never strand a customer
 * or charge a wrong amount. The actual pricing + charge reuse the same
 * /api/checkout-quote and /api/create-payment the standard checkout uses.
 */
export function ExpressCheckout({ squareConfig }: { squareConfig: SquareWebPaymentsConfig }) {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const paymentsRef = useRef<SquarePaymentsApi | null>(null);
  const applePayRef = useRef<SquareWallet | null>(null);
  const googlePayRef = useRef<SquareWallet | null>(null);
  const idempotencyKeyRef = useRef<string>("");
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const enabled = isExpressCheckoutEnabled();
  const canRender = enabled && Boolean(squareConfig.applicationId && squareConfig.locationId) && items.length > 0;

  if (!idempotencyKeyRef.current && typeof crypto !== "undefined") idempotencyKeyRef.current = crypto.randomUUID();

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
        // Preliminary total (subtotal). The authoritative discounted/taxed total
        // is recomputed server-side before charging; a mismatch fails safe.
        total: { amount: expressTotalAmount(total), label: "After Hours Agenda" },
        requestShippingContact: true,
        requestBillingContact: true,
      });
      try {
        const applePay = await payments.applePay(request);
        applePayRef.current = applePay;
        setApplePayReady(true);
      } catch { /* Apple Pay unavailable on this device/domain */ }
      try {
        const googlePay = await payments.googlePay(request);
        googlePayRef.current = googlePay;
        await googlePay.attach?.("#aha-express-gpay", { buttonColor: "black", buttonType: "buy", buttonSizeMode: "fill" });
        setGooglePayReady(true);
      } catch { /* Google Pay unavailable on this device */ }
    } catch { /* SDK init failed — express simply doesn't render; normal checkout is unaffected */ }
  }, [squareConfig, total, canRender]);

  useEffect(() => {
    if (canRender && squareGlobal()) void initWallets();
  }, [canRender, initWallets]);

  const toCheckout = () => router.push("/checkout");

  const payWithWallet = async (wallet: SquareWallet | null) => {
    if (!wallet || busy) return;
    setBusy(true);
    try {
      const t = await wallet.tokenize();
      if (t.status !== "OK" || !t.token) { setBusy(false); return; } // shopper dismissed the sheet

      const contact = extractExpressContact(t.details);
      if (!contact) { toCheckout(); return; } // no usable address → finish on the form

      const lines = items.map((i) => ({ squareVariationId: i.variationId, quantity: i.quantity }));

      // Authoritative total from the same endpoint the normal checkout uses.
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

      // The confirmation page fires the conversion/purchase analytics event.
      sessionStorage.setItem("aha-last-order", JSON.stringify({
        orderNumber: payData.orderNumber,
        receiptUrl: typeof payData.receiptUrl === "string" ? payData.receiptUrl : null,
        items: items.map((i) => ({ name: i.name, variationName: i.variationName, quantity: i.quantity, lineTotal: i.price * i.quantity, productId: i.productId, slug: i.slug, variationId: i.variationId, price: i.price, priceFormatted: i.priceFormatted, image: i.image })),
        subtotal: total,
        discount: Math.max(0, total - quote.subtotal),
        total: quote.total,
        currency: quote.currency,
        shippingName: contact.shippingName,
        shippingAddress: contact.shippingAddress,
      }));
      clearCart();
      router.push(`/order-confirmed?order=${encodeURIComponent(payData.orderNumber)}`);
    } catch {
      toCheckout(); // any unexpected error → the proven path
    }
  };

  if (!canRender) return null;

  return (
    <>
      <Script src={squareConfig.sdkUrl} strategy="afterInteractive" onLoad={() => void initWallets()} />
      {(applePayReady || googlePayReady) && (
        <div className="mb-4">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Express checkout</p>
          <div className="flex flex-col gap-2">
            {applePayReady && (
              <button type="button" onClick={() => void payWithWallet(applePayRef.current)} disabled={busy} aria-label="Buy now with Apple Pay" className="min-h-12 w-full bg-cream text-void disabled:opacity-60">
                <span className="text-sm font-bold"> Pay</span>
              </button>
            )}
            <div id="aha-express-gpay" onClick={() => void payWithWallet(googlePayRef.current)} className={googlePayReady ? "min-h-12 w-full" : "hidden"} />
          </div>
          <p className="mt-2 text-center text-[10px] leading-snug text-muted">Uses the address from your wallet. If anything&rsquo;s missing you&rsquo;ll finish on the secure checkout page.</p>
        </div>
      )}
    </>
  );
}
