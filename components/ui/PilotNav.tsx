"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";

const navLinks = [
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Track order", href: "/track-order" },
];

export function PilotNav() {
  const { totalItems, setCartOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-[100] border-b border-border/60 bg-void/95 backdrop-blur-sm after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-1/3 after:bg-accent after:content-['']">
      <nav aria-label="Primary navigation" className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-base font-bold uppercase tracking-[-0.03em] text-cream hover:text-accent focus-visible:outline-offset-4">
          After Hours Agenda
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link inline-flex min-h-11 items-center px-3 font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted hover:text-cream"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="primary-action min-h-11 px-4 font-mono text-xs font-bold uppercase tracking-[0.06em]"
            aria-label={`Open bag${totalItems ? `, ${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}`}
          >
            Bag{totalItems ? ` ${totalItems}` : ""}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted hover:text-cream md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        data-open={mobileOpen}
        className="mobile-menu absolute left-0 right-0 top-full border-b border-border/60 bg-void/98 px-4 py-5 shadow-lg md:hidden"
      >
        <ul className="space-y-1">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="inline-flex min-h-11 w-full items-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted hover:text-accent"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
