"use client";

import { useCart } from "./CartProvider";
import Image from "next/image";
import Link from "next/link";

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
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface border-l border-border transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-display font-bold text-lg">YOUR BAG</h2>
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

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted mb-4">Your bag is empty</p>
                <button
                  onClick={toggleCart}
                  className="font-mono text-sm text-glow hover:text-cream transition-colors"
                >
                  CONTINUE SHOPPING &rarr;
                </button>
              </div>
            ) : (
              <ul className="space-y-6">
                {items.map((item) => (
                  <li
                    key={item.variationId}
                    className="flex gap-4"
                  >
                    {item.image && (
                      <div className="relative w-20 h-20 bg-elevated rounded overflow-hidden flex-shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
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
                          className="w-6 h-6 flex items-center justify-center border border-border text-xs hover:border-cream transition-colors"
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
                          className="w-6 h-6 flex items-center justify-center border border-border text-xs hover:border-cream transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.variationId)}
                          className="ml-auto text-xs text-muted hover:text-danger transition-colors"
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
            <div className="border-t border-border px-6 py-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Subtotal</span>
                <span className="font-mono font-medium">{totalFormatted}</span>
              </div>
              <p className="text-xs text-muted">
                Shipping calculated at checkout
              </p>
              <Link
                href="/cart"
                onClick={toggleCart}
                className="block w-full py-3 bg-cream text-void font-display font-bold text-center text-sm tracking-wide hover:bg-glow transition-colors"
              >
                CHECKOUT
              </Link>
              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <span className="text-[10px] text-muted font-mono">🔒 SECURE</span>
                <span className="text-[10px] text-muted font-mono">📦 FREE SHIP $75+</span>
                <span className="text-[10px] text-muted font-mono">↩️ 30-DAY RETURNS</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
