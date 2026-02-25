"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { items, toggleCart } = useCart();

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-void/95 backdrop-blur-md border-b border-border"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Left: Sheep micro mark */}
          <Link href="/" className="flex items-center gap-3 group" aria-label="Home">
            <svg
              className="w-6 h-6 text-cream group-hover:text-gold transition-colors"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M50 85 C30 85, 18 70, 18 55 C18 40, 28 28, 50 28 C72 28, 82 40, 82 55 C82 70, 70 85, 50 85 Z"/>
              <path d="M22 45 C14 38, 6 32, 4 24 C2 16, 8 12, 16 16 C20 18, 20 28, 22 38"/>
              <path d="M78 45 C86 38, 94 32, 96 24 C98 16, 92 12, 84 16 C80 18, 80 28, 78 38"/>
            </svg>
          </Link>

          {/* Center: Brand name */}
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 font-mono text-sm tracking-[0.3em] uppercase text-cream hover:text-gold transition-colors"
          >
            AFTER HOURS AGENDA
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Desktop nav links */}
            <Link
              href="/shop"
              className="hidden md:block text-sm font-mono text-muted hover:text-cream transition-colors tracking-wide"
            >
              Shop
            </Link>

            {/* Cart */}
            <button
              onClick={toggleCart}
              className="relative p-2 text-muted hover:text-cream transition-colors"
              aria-label="Open cart"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold text-void text-[10px] font-mono font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-muted hover:text-cream transition-colors"
              aria-label="Toggle menu"
            >
              <div className="w-5 flex flex-col gap-1.5">
                <span
                  className={`block h-[1.5px] bg-current transition-all duration-300 ${
                    menuOpen ? "rotate-45 translate-y-[4.5px]" : ""
                  }`}
                />
                <span
                  className={`block h-[1.5px] bg-current transition-all duration-300 ${
                    menuOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`block h-[1.5px] bg-current transition-all duration-300 ${
                    menuOpen ? "-rotate-45 -translate-y-[4.5px]" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile fullscreen menu */}
      <div
        className={`fixed inset-0 z-40 bg-void/98 backdrop-blur-lg flex flex-col items-center justify-center transition-all duration-500 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col items-center gap-8">
          {[
            { href: "/shop", label: "Shop" },
            { href: "/collections/black-sheep", label: "Collections" },
            { href: "/about", label: "About" },
            { href: "/faq", label: "FAQ" },
            { href: "/contact", label: "Contact" },
          ].map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-display text-4xl font-bold text-cream hover:text-gold transition-colors"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Subtle sheep silhouette at bottom */}
        <div className="absolute bottom-12 opacity-10">
          <svg
            className="w-16 h-16 text-cream"
            viewBox="0 0 200 160"
            fill="currentColor"
          >
            <path d="M60 55 C40 50, 25 60, 25 78 C25 96, 35 108, 55 110 L55 140 L65 140 L65 112 L90 114 L90 140 L100 140 L100 114 L125 112 L125 140 L135 140 L135 110 L150 108 L150 140 L160 140 L160 105 C175 98, 180 85, 178 72 C176 58, 165 48, 150 48 C145 42, 135 40, 125 42 C115 36, 100 35, 88 38 C78 34, 65 38, 60 48 Z"/>
            <path d="M25 78 C18 75, 10 68, 8 60 C6 52, 10 44, 18 40 C26 36, 35 38, 40 44 C42 48, 40 55, 35 60 C30 65, 25 72, 25 78 Z"/>
            <ellipse cx="20" cy="54" rx="4" ry="5" fill="#0A0A0A"/>
            <path d="M18 40 C14 32, 8 28, 4 30 C0 32, 2 38, 8 42 Z"/>
          </svg>
        </div>
      </div>
    </>
  );
}
