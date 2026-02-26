"use client";

import { useCart } from "./CartProvider";
import Image from "next/image";
import Link from "next/link";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { isPrintfulImage } from "@/lib/utils/image-helpers";

export function CartDrawer() {
  const { items, isOpen, toggleCart, removeItem, updateQuantity, totalFormatted } =
    useCart();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleCart}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-void border-l border-border noise-overlay transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4">
            {/* Station label */}
            <p className="font-mono text-[9px] text-muted/50 uppercase tracking-[0.2em] mb-3">
              STATION: CHECKOUT
            </p>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">YOUR METROCARD</h2>
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
                <p className="font-mono text-sm text-muted mb-4 uppercase tracking-[0.1em]">
                  No Fare Loaded
                </p>
                <button
                  onClick={toggleCart}
                  className="font-mono text-sm text-cream hover:text-white transition-colors uppercase tracking-[0.1em]"
                >
                  LOAD YOUR METROCARD &rarr;
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-cream/5">
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
                          className={isPrintfulImage(item.image) ? "object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]" : "object-cover"}
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
                          className="ml-auto font-mono text-xs text-muted hover:text-line-red transition-colors"
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
              {/* MetroCard reader display */}
              <div className="bg-[#0a0a0a] border border-border/50 px-4 py-3 scan-lines overflow-hidden">
                <div className="flex justify-between items-center font-mono relative z-10">
                  <span className="text-[10px] text-[#E8E4DE]/50 uppercase tracking-[0.15em]">
                    Subtotal
                  </span>
                  <span className="text-lg font-bold text-[#E8E4DE] tracking-wider">
                    {totalFormatted}
                  </span>
                </div>
                <p className="text-[10px] text-[#E8E4DE]/30 font-mono mt-1 relative z-10">
                  Shipping calculated at checkout
                </p>
              </div>
              {/* Checkout button - MetroCard gradient */}
              <Link
                href="/cart"
                onClick={toggleCart}
                className="metrocard-gradient block w-full py-3 font-display font-bold text-center text-sm tracking-wide hover:brightness-110 transition-all"
              >
                ENTER THE PLATFORM &rarr;
              </Link>
              {/* Trust line */}
              <p className="font-mono text-[10px] text-muted text-center pt-2 tracking-[0.1em]">
                SECURE &middot; FREE TRANSFER $75+ &middot; 30-DAY RETURNS
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
