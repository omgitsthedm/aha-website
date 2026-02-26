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

      // Redirect to Square's hosted checkout
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
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display font-bold text-chapter mb-4">YOUR BAG</h1>
          <p className="font-body text-muted mb-8">Your bag is empty.</p>
          <Link
            href="/shop"
            className="metrocard-gradient inline-block px-8 py-3 font-body text-xs font-bold uppercase tracking-[0.15em] hover:brightness-110 transition-all"
          >
            Start Shopping &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display font-bold text-chapter mb-2">YOUR BAG</h1>
        <p className="font-body text-sm text-muted mb-8">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Items column */}
          <div className="lg:col-span-2">
            <WhiteBand />
            <ul className="divide-y divide-cream/10">
              {items.map((item) => (
                <li key={item.variationId} className="flex gap-4 md:gap-6 py-6">
                  {/* Image */}
                  <Link
                    href={`/product/${item.slug || item.productId}`}
                    className="relative w-24 h-24 md:w-32 md:h-32 bg-elevated overflow-hidden flex-shrink-0 block"
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
                            : "object-cover"
                        }
                        sizes="128px"
                      />
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.slug || item.productId}`}
                      className="font-display font-bold text-sm hover:text-cream/70 transition-colors"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted mt-1">{item.variationName}</p>
                    <p className="font-mono text-sm mt-2">{item.priceFormatted}</p>

                    {/* Quantity + Remove */}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() =>
                          updateQuantity(item.variationId, item.quantity - 1)
                        }
                        className="w-11 h-11 flex items-center justify-center border border-cream/15 font-mono text-sm text-muted hover:border-cream/40 hover:text-cream transition-all duration-200 rounded-sm"
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
                        className="w-11 h-11 flex items-center justify-center border border-cream/15 font-mono text-sm text-muted hover:border-cream/40 hover:text-cream transition-all duration-200 rounded-sm"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.variationId)}
                        className="ml-auto font-body text-xs text-muted hover:text-line-red transition-colors underline underline-offset-2"
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
            <div className="bg-surface border border-border rounded-sm p-6 lg:sticky lg:top-28">
              <h2 className="font-display font-bold text-sm uppercase tracking-[0.1em] mb-6">
                Order Summary
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted">Subtotal</span>
                  <span className="font-mono">{totalFormatted}</span>
                </div>
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted">Shipping</span>
                  <span className="text-muted text-xs">Calculated at checkout</span>
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
                <p className="font-body text-xs text-muted mb-4 text-center">
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
                <p className="font-body text-xs text-[#4CAF50] mb-4 text-center font-medium">
                  ✓ You qualify for free shipping
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
                className="metrocard-gradient block w-full py-3 font-body font-bold text-center text-sm tracking-wide hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut ? "Processing..." : "Checkout →"}
              </button>

              {/* Trust badges */}
              <div className="mt-4 space-y-2">
                <p className="font-body text-[11px] text-muted text-center tracking-[0.1em]">
                  Secure Checkout &middot; Free Shipping $75+ &middot; 30-Day Returns
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Continue shopping */}
        <div className="mt-12 text-center">
          <Link
            href="/shop"
            className="font-body text-xs text-muted hover:text-cream transition-colors uppercase tracking-[0.1em]"
          >
            &larr; Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
