"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { isPrintfulImage } from "@/lib/utils/image-helpers";
import { WhiteBand } from "@/components/ui/WhiteBand";

export function CartPageContent() {
  const { items, removeItem, updateQuantity, totalFormatted, totalItems, total } =
    useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const freeShippingThreshold = 7500; // $75 in cents
  const qualifiesForFreeShipping = total >= freeShippingThreshold;
  const amountToFreeShipping = freeShippingThreshold - total;

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            catalogObjectId: item.variationId,
            quantity: item.quantity,
            name: item.name,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      // Validate checkout URL before redirecting (only allow Square domains)
      const checkoutUrl = new URL(data.checkoutUrl);
      const allowedHosts = ["squareup.com", "square.link"];
      const isAllowedHost = allowedHosts.some(
        (host) => checkoutUrl.hostname === host || checkoutUrl.hostname.endsWith(`.${host}`)
      );
      if (!isAllowedHost) {
        throw new Error("Invalid checkout URL received");
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setIsCheckingOut(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="misprint font-display text-[clamp(3.5rem,9vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] mb-4">
            Your Bag
          </h1>
          <p className="font-body text-muted mb-8 font-bold">Your bag is empty.</p>
          <Link
            href="/shop"
            className="metrocard-gradient inline-block px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] hover:brightness-110 transition-all"
          >
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-16 pt-28 md:px-6 md:pt-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="misprint font-display text-[clamp(3.5rem,9vw,7rem)] font-black uppercase leading-[0.82] tracking-[-0.08em] mb-3">
          Your Bag
        </h1>
        <p className="font-body text-sm text-muted mb-8 font-bold uppercase tracking-[0.08em]">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Items column */}
          <div className="lg:col-span-2">
            <WhiteBand />
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={item.variationId} className="zine-block flex gap-4 p-4 md:gap-6 md:p-5">
                  {/* Image */}
                  <Link
                    href={`/product/${item.slug || item.productId}`}
                    className="relative block h-24 w-24 flex-shrink-0 overflow-hidden border-[3px] border-[#E9E1D4] bg-elevated md:h-32 md:w-32"
                  >
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        unoptimized={isPrintfulImage(item.image)}
                        className={
                          isPrintfulImage(item.image)
                            ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
                            : "object-cover xerox-image"
                        }
                        sizes="128px"
                      />
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug || item.productId}`}
                      className="font-display text-xl font-black uppercase leading-none tracking-[-0.04em] transition-colors hover:text-[#CCFF00]"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs font-bold uppercase text-muted mt-1">{item.variationName}</p>
                    <p className="font-mono text-sm font-bold mt-2">{item.priceFormatted}</p>

                    {/* Quantity + Remove */}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() =>
                          updateQuantity(item.variationId, item.quantity - 1)
                        }
                        className="flex h-11 w-11 items-center justify-center border-[3px] border-[#E9E1D4] font-mono text-sm font-bold text-muted transition-all duration-200 hover:bg-[#E9E1D4] hover:text-[#10100F]"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        &minus;
                      </button>
                      <span className="font-mono text-sm w-6 text-center" aria-live="polite" aria-atomic="true">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.variationId, item.quantity + 1)
                        }
                        className="flex h-11 w-11 items-center justify-center border-[3px] border-[#E9E1D4] font-mono text-sm font-bold text-muted transition-all duration-200 hover:bg-[#E9E1D4] hover:text-[#10100F]"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.variationId)}
                        className="ml-auto font-body text-xs font-bold uppercase text-muted underline underline-offset-4 transition-colors hover:text-[#FF006E]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Order summary column */}
          <div className="lg:col-span-1">
            <div className="zine-block p-6 lg:sticky lg:top-28">
              <h2 className="font-display text-3xl font-black uppercase leading-none tracking-[-0.05em] mb-6">
                Order Summary
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between font-body text-sm font-bold">
                  <span className="text-muted">Subtotal</span>
                  <span className="font-mono">{totalFormatted}</span>
                </div>
                <div className="flex justify-between font-body text-sm font-bold">
                  <span className="text-muted">Shipping</span>
                  <span className="text-muted text-xs uppercase">Calculated at checkout</span>
                </div>
              </div>

              <WhiteBand />

              <div className="flex justify-between items-center py-4">
                <span className="font-body font-bold text-sm uppercase tracking-[0.1em]">
                  Total
                </span>
                <span className="font-mono text-lg font-bold">{totalFormatted}</span>
              </div>

              {/* Free shipping progress */}
              {!qualifiesForFreeShipping && (
                <p className="font-body text-xs font-bold text-muted mb-4 text-center">
                  Add{" "}
                  <span className="font-mono text-cream">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(amountToFreeShipping / 100)}
                  </span>{" "}
                  more for free shipping
                </p>
              )}
              {qualifiesForFreeShipping && (
                <p className="font-body text-xs text-[#39FF14] mb-4 text-center font-bold uppercase">
                  You qualify for free shipping
                </p>
              )}

              {/* Error */}
              {error && (
                <p className="font-body text-xs text-line-red mb-4 text-center">
                  {error}
                </p>
              )}

              {/* Checkout button */}
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="metrocard-gradient block w-full py-3 font-body font-bold text-center text-sm tracking-wide transition-transform hover:-translate-y-1 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCheckingOut ? "Processing..." : "Checkout"}
              </button>

              {/* Trust badges */}
              <div className="mt-4 space-y-2">
                <p className="font-body text-[11px] font-bold text-muted text-center tracking-[0.08em] uppercase">
                  Secure Checkout / Free Shipping $75+ / Thirty-Day Returns
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Continue shopping */}
        <div className="mt-12 text-center">
          <Link
            href="/shop"
            className="font-body text-xs font-bold text-muted hover:text-cream transition-colors uppercase tracking-[0.1em] underline underline-offset-4"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
