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
  { label: "Shop All", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems, setCartOpen } = useCart();

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
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-50 h-20 flex items-center transition-all duration-300 backdrop-blur-xl ${
          scrolled
            ? "bg-[rgba(10,10,10,0.92)]"
            : "bg-[rgba(10,10,10,0.75)]"
        }`}
      >
        <div className="w-full px-6 flex items-center justify-between">
          {/* Left — Mark + Brand */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[#E8E4DE] hover:text-white transition-colors"
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
              className="hidden sm:block font-body font-bold text-[13px] tracking-[0.15em] text-[#E8E4DE] hover:text-white transition-colors uppercase"
              onClick={() => setMenuOpen(false)}
            >
              After Hours Agenda
            </Link>
          </div>

          {/* Right — Shop + Cart + Hamburger */}
          <div className="flex items-center gap-6">
            <Link
              href="/shop"
              className="hidden md:flex items-center gap-2 font-body font-medium text-xs text-[#7A756E] hover:text-white transition-colors uppercase tracking-[0.15em] nav-link-hover"
            >
              <span className="w-4 h-4 rounded-full bg-line-yellow inline-flex items-center justify-center flex-shrink-0">
                <span className="text-[7px] font-mono font-bold text-[#141414] leading-none">S</span>
              </span>
              Shop
            </Link>

            <button
              onClick={() => setCartOpen(true)}
              className="relative text-[#E8E4DE] hover:text-white transition-colors"
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
                <span className="absolute -top-2 -right-3 bg-line-yellow text-[#141414] text-[9px] font-mono font-bold w-[18px] h-[18px] flex items-center justify-center rounded-full whitespace-nowrap shadow-[0_0_6px_rgba(252,204,10,0.35)]">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Hamburger — mobile */}
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="md:hidden flex flex-col justify-center items-center w-11 h-11 gap-[5px]"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
            >
              <span
                className={`block w-5 h-[1.5px] bg-[#E8E4DE] transition-transform duration-300 origin-center ${
                  menuOpen ? "translate-y-[6.5px] rotate-45" : ""
                }`}
              />
              <span
                className={`block w-5 h-[1.5px] bg-[#E8E4DE] transition-opacity duration-300 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block w-5 h-[1.5px] bg-[#E8E4DE] transition-transform duration-300 origin-center ${
                  menuOpen ? "-translate-y-[6.5px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Bottom platform stripe */}
        <div className="absolute bottom-0 left-0 right-0 platform-stripe" />
      </nav>

      {/* Mobile menu — full-screen station directory */}
      <div
        id="mobile-nav-menu"
        role="navigation"
        aria-label="Mobile navigation"
        className={`fixed inset-0 z-40 bg-[#141414] subway-tiles-dark transition-opacity duration-300 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="pt-28 px-8 pb-24 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-7rem)]">
          {/* Collection routes */}
          {COLLECTIONS.map((col) => (
            <Link
              key={col.slug}
              href={`/collections/${col.slug}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between py-4 text-[#7A756E] hover:text-white transition-colors group border-l-2 pl-4"
              style={{ borderColor: col.line.color + "40" }}
            >
              <div className="flex items-center gap-4">
                <RouteBadge slug={col.slug} size="md" />
                <span className="font-body font-medium text-lg">{col.name}</span>
              </div>
              <span className="font-body text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                &rarr;
              </span>
            </Link>
          ))}

          {/* Separator */}
          <div className="my-6">
            <WhiteBand dark />
          </div>

          {/* Other links */}
          {OTHER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-body font-medium text-lg text-[#7A756E] hover:text-white transition-colors py-4 border-l-2 border-[#7A756E]/20 pl-4"
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
