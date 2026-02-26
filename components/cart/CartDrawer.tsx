"use client";

import { useState, useEffect } from "react";
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

  const drawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleCart}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-[9999] h-full w-full max-w-md bg-void border-l border-border transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-body font-bold text-lg uppercase tracking-[0.1em]">Your Bag</h2>
              <button
                onClick={toggleCart}
                className="text-muted hover:text-cream transition-colors p-1"
                aria-label="Close cart"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
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
                  className="font-body font-medium text-sm text-cream hover:text-cream/70 transition-colors uppercase tracking-[0.1em]"
                >
                  Start Shopping &rarr;
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-cream/10">
                {items.map((item) => (
                  <li
                    key={item.variationId}
                    className="flex gap-4 py-6 first:pt-0"
                  >
                    {item.image && (
                      <div className="relative w-20 h-20 bg-elevated overflow-hidden flex-shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          unoptimized={isPrintfulImage(item.image)}
                          className={isPrintfulImage(item.image) ? "object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "object-cover"}
                          sizes="80px"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-body truncate">{item.name}</h3>
                      <p className="text-xs text-muted mt-0.5">{item.variationName}</p>
                      <p className="font-mono text-sm mt-1">{item.priceFormatted}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.variationId, item.quantity - 1)
                          }
                          className="w-7 h-7 flex items-center justify-center border border-cream/15 font-mono text-xs text-muted hover:border-cream/40 hover:text-cream transition-all duration-200 rounded-sm"
                        >
                          &minus;
                        </button>
                        <span className="font-mono text-xs w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.variationId, item.quantity + 1)
                          }
                          className="w-7 h-7 flex items-center justify-center border border-cream/15 font-mono text-xs text-muted hover:border-cream/40 hover:text-cream transition-all duration-200 rounded-sm"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.variationId)}
                          className="ml-auto font-body font-medium text-xs text-muted hover:text-line-red transition-colors"
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
              <p className="text-[11px] text-muted font-body mb-4">
                Shipping calculated at checkout
              </p>
              {/* Checkout button */}
              <Link
                href="/cart"
                onClick={toggleCart}
                className="metrocard-gradient block w-full py-3 font-body font-bold text-center text-sm tracking-wide hover:brightness-110 transition-all"
              >
                Checkout &rarr;
              </Link>
              {/* Trust line */}
              <p className="font-body font-medium text-[10px] text-muted text-center pt-3 tracking-[0.1em]">
                Secure Checkout &middot; Free Shipping $75+ &middot; 30-Day Returns
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
