"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";

const COLLECTIONS = Object.values(SUBWAY_LINES).map((line) => ({
  slug: line.slug,
  name: line.name,
  line,
}));

const OTHER_LINKS = [
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems, totalFormatted, setCartOpen } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-20 flex items-center transition-colors duration-300 ${
          scrolled
            ? "bg-[rgba(20,20,20,0.85)] backdrop-blur-md noise-overlay"
            : "bg-transparent"
        }`}
      >
        <div className="w-full px-6 flex items-center justify-between">
          {/* Left — Mark + Brand */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-cream hover:text-white transition-colors"
              aria-label="Home"
              onClick={() => setMenuOpen(false)}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="block"
              >
                <path
                  d="M50 10C30 10 15 25 15 45C15 55 20 63 28 68L25 85C25 88 28 90 30 88L38 78C42 80 46 81 50 81C70 81 85 66 85 46C85 26 70 10 50 10ZM35 45C33 45 31 43 31 41C31 39 33 37 35 37C37 37 39 39 39 41C39 43 37 45 35 45ZM55 55C50 60 40 60 35 55L55 55ZM65 45C63 45 61 43 61 41C61 39 63 37 65 37C67 37 69 39 69 41C69 43 67 45 65 45Z"
                  fill="currentColor"
                />
              </svg>
            </Link>

            <Link
              href="/"
              className="hidden sm:block font-mono text-[13px] tracking-[0.3em] text-cream hover:text-white transition-colors uppercase"
              onClick={() => setMenuOpen(false)}
            >
              After Hours Agenda
            </Link>
          </div>

          {/* Right — Shop + Cart + Hamburger */}
          <div className="flex items-center gap-6">
            <Link
              href="/collections"
              className="hidden md:block font-mono text-xs text-muted hover:text-white transition-colors uppercase tracking-[0.15em]"
            >
              Shop
            </Link>

            <button
              onClick={() => setCartOpen(true)}
              className="relative text-cream hover:text-white transition-colors"
              aria-label="Open cart"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-3 bg-line-yellow text-void text-[9px] font-mono font-bold px-1.5 h-4 flex items-center justify-center rounded-sm whitespace-nowrap shadow-[0_0_4px_rgba(252,204,10,0.4)]">
                  {totalFormatted || totalItems}
                </span>
              )}
            </button>

            {/* Hamburger — mobile */}
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px]"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              <span
                className={`block w-5 h-[1.5px] bg-cream transition-transform duration-300 origin-center ${
                  menuOpen ? "translate-y-[6.5px] rotate-45" : ""
                }`}
              />
              <span
                className={`block w-5 h-[1.5px] bg-cream transition-opacity duration-300 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block w-5 h-[1.5px] bg-cream transition-transform duration-300 origin-center ${
                  menuOpen ? "-translate-y-[6.5px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Bottom white band when scrolled */}
        {scrolled && (
          <div className="absolute bottom-0 left-0 right-0">
            <WhiteBand />
          </div>
        )}
      </nav>

      {/* Mobile menu — full-screen station directory */}
      <div
        className={`fixed inset-0 z-40 bg-void subway-tiles-dark transition-opacity duration-300 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="pt-24 px-8 flex flex-col gap-2">
          {/* Collection routes */}
          {COLLECTIONS.map((col) => (
            <Link
              key={col.slug}
              href={`/collections/${col.slug}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between py-3 text-muted hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-4">
                <RouteBadge slug={col.slug} size="md" />
                <span className="font-mono text-lg">{col.name}</span>
              </div>
              <span className="font-mono text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                &rarr;
              </span>
            </Link>
          ))}

          {/* Separator */}
          <div className="my-4">
            <WhiteBand />
          </div>

          {/* Other links */}
          {OTHER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-lg text-muted hover:text-white transition-colors py-3"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export default NavBar;
