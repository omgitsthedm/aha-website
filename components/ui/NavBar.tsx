"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";

const COLLECTIONS = Object.values(SUBWAY_LINES).map((line) => ({
  slug: line.slug,
  name: line.name,
  line,
}));

const PRIMARY_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
];

export function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems, setCartOpen } = useCart();

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed top-0 left-0 right-0 z-[100] border-b-[4px] border-[#E9E1D4] bg-[#10100F]/95 backdrop-blur-sm"
      >
        <div className="flex h-[76px] w-full items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="group flex min-h-11 items-center gap-3 text-[#E9E1D4] transition-transform duration-200 hover:-translate-y-0.5"
            aria-label="After Hours Agenda home"
            onClick={() => setMenuOpen(false)}
          >
            <span className="relative flex h-11 w-11 items-center justify-center border-[3px] border-[#E9E1D4] bg-[#CCFF00] shadow-[5px_5px_0_#FF006E]">
              <Image
                src="/brand/sheep-head.svg"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7"
                aria-hidden="true"
              />
            </span>
            <span className="hidden max-w-[190px] font-display text-[15px] font-black uppercase leading-[0.95] tracking-[-0.03em] sm:block">
              After Hours Agenda
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="min-h-11 inline-flex items-center font-body text-sm font-bold uppercase tracking-[0.08em] text-[#E9E1D4] underline decoration-[#CCFF00] decoration-2 underline-offset-4 transition-colors hover:text-[#CCFF00]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCartOpen(true)}
              className="relative min-h-11 border-[3px] border-[#E9E1D4] bg-[#BF00FF] px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#E9E1D4] shadow-[5px_5px_0_#00FFFF] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              aria-label="Open cart"
            >
              Bag
              {totalItems > 0 && (
                <span className="absolute -right-3 -top-3 flex h-7 min-w-7 items-center justify-center border-2 border-[#10100F] bg-[#CCFF00] px-1 font-mono text-[11px] font-bold text-[#10100F]">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] border-[3px] border-[#E9E1D4] bg-[#15110F] md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
            >
              <span
                className={`block h-[2px] w-5 bg-[#E9E1D4] transition-transform duration-200 ${
                  menuOpen ? "translate-y-[7px] rotate-45" : ""
                }`}
              />
              <span
                className={`block h-[2px] w-5 bg-[#E9E1D4] transition-opacity duration-200 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block h-[2px] w-5 bg-[#E9E1D4] transition-transform duration-200 ${
                  menuOpen ? "-translate-y-[7px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>
        <div className="platform-edge" />
      </nav>

      <div
        id="mobile-nav-menu"
        role="navigation"
        aria-label="Mobile navigation"
        className={`fixed inset-0 z-[90] bg-[#10100F] color-pop-grid px-6 pb-10 pt-28 transition-opacity duration-200 md:hidden ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="zine-block-lime zine-cut mb-8 p-5">
          <p className="font-display text-4xl font-black uppercase leading-none tracking-[-0.06em]">
            Loud links for late nights
          </p>
        </div>

        <div className="grid gap-3">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="zine-paper min-h-14 px-4 py-3 font-body text-lg font-bold uppercase tracking-[0.04em] transition-transform hover:-translate-y-0.5"
            >
              {link.label}
            </Link>
          ))}

          {COLLECTIONS.map((col) => (
            <Link
              key={col.slug}
              href={`/collections/${col.slug}`}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-14 items-center gap-3 border-[3px] border-[#E9E1D4] bg-[#15110F] px-4 py-3 font-body text-sm font-bold uppercase tracking-[0.04em] text-[#E9E1D4]"
            >
              <RouteBadge slug={col.slug} size="md" />
              {col.name}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export default NavBar;
