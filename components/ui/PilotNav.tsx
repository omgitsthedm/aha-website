"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

export function PilotNav() {
  const { totalItems, setCartOpen } = useCart();

  return (
    <header className="fixed inset-x-0 top-0 z-[100] border-b border-border/60 bg-void/95 backdrop-blur-sm after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-1/3 after:bg-accent after:content-['']">
      <nav aria-label="Primary navigation" className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-base font-bold uppercase tracking-[-0.03em] text-cream hover:text-accent">
          After Hours Agenda
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/shop" className="inline-flex min-h-11 items-center px-3 font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted hover:text-cream">
            Three hoodies
          </Link>
          <button type="button" onClick={() => setCartOpen(true)} className="primary-action min-h-11 px-4 font-mono text-xs font-bold uppercase tracking-[0.06em]" aria-label={`Open bag${totalItems ? `, ${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}`}>
            Bag{totalItems ? ` ${totalItems}` : ""}
          </button>
        </div>
      </nav>
    </header>
  );
}
