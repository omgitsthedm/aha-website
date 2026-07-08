"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useCart } from "./CartProvider";
import Image from "next/image";
import Link from "next/link";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

export function CartDrawer() {
  const { items, isOpen, toggleCart, removeItem, updateQuantity, totalFormatted } =
    useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        toggleCart();
      }
    },
    [isOpen, toggleCart]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const drawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9999] bg-[#10100F]/78 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleCart}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
        className={`fixed top-0 right-0 z-[9999] h-full w-full max-w-md border-l-[5px] border-[#E9E1D4] bg-[#10100F] transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-4xl font-black uppercase leading-none tracking-[-0.06em]">Your Bag</h2>
              <button
                onClick={toggleCart}
                className="min-h-11 border-[3px] border-[#E9E1D4] px-3 font-body text-xs font-bold uppercase text-muted transition-colors hover:bg-[#E9E1D4] hover:text-[#10100F]"
                aria-label="Close cart"
              >
                Close
              </button>
            </div>
            <WhiteBand />
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="font-body font-medium text-sm text-muted mb-4">
                  Your bag is empty
                </p>
                <button
                  onClick={toggleCart}
                  className="metrocard-gradient px-5 py-3 font-body text-xs font-bold uppercase tracking-[0.1em]"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li
                    key={item.variationId}
                    className="zine-block flex gap-4 p-4"
                  >
                    {item.image && (
                      <div className="relative w-20 h-20 bg-elevated overflow-hidden flex-shrink-0 border-[3px] border-[#E9E1D4]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          unoptimized={isPrintfulImage(item.image)}
                          className={isPrintfulImage(item.image) ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "object-cover xerox-image"}
                          sizes="80px"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate font-display text-lg font-black uppercase leading-none tracking-[-0.04em]">{item.name}</h3>
                      <p className="text-xs text-muted mt-1 font-bold uppercase">{item.variationName}</p>
                      <p className="font-mono text-sm mt-1 font-bold">{item.priceFormatted}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.variationId, item.quantity - 1)
                          }
                          className="w-11 h-11 flex items-center justify-center border-[3px] border-[#E9E1D4] font-mono text-sm font-bold text-muted hover:bg-[#E9E1D4] hover:text-[#10100F] transition-all duration-200"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          &minus;
                        </button>
                        <span className="font-mono text-xs w-6 text-center" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.variationId, item.quantity + 1)
                          }
                          className="w-11 h-11 flex items-center justify-center border-[3px] border-[#E9E1D4] font-mono text-sm font-bold text-muted hover:bg-[#E9E1D4] hover:text-[#10100F] transition-all duration-200"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.variationId)}
                          className="ml-auto font-body font-bold text-xs text-muted hover:text-[#FF006E] transition-colors uppercase underline underline-offset-4"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-6 py-4 space-y-4">
              <WhiteBand />
              {/* Subtotal */}
              <div className="flex justify-between items-center py-3">
                <span className="font-body font-medium text-sm text-muted uppercase tracking-[0.1em]">
                  Subtotal
                </span>
                <span className="font-mono text-lg font-bold text-cream tracking-wider">
                  {totalFormatted}
                </span>
              </div>
              <p className="text-xs text-muted font-body mb-4">
                Shipping calculated at checkout
              </p>
              {/* Checkout button */}
              <Link
                href="/cart"
                onClick={toggleCart}
                className="metrocard-gradient block w-full py-3 font-body font-bold text-center text-sm tracking-wide transition-transform hover:-translate-y-1"
              >
                Checkout
              </Link>
              {/* Trust line */}
              <p className="font-body font-medium text-[11px] text-muted text-center pt-3 tracking-[0.1em]">
                Secure Checkout / Free Shipping $75+ / Thirty-Day Returns
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  return createPortal(drawer, document.body);
}
