"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

const genderLinks = [
  {
    label: "Men",
    href: "/men",
    subLinks: [
      { label: "Shop All", href: "/men" },
      { label: "T-Shirts", href: "/men/t-shirts" },
      { label: "Hoodies & Sweatshirts", href: "/men/hoodies-sweatshirts" },
      { label: "Sweaters & Knitwear", href: "/men/sweaters-knitwear" },
      { label: "Accessories", href: "/men/accessories" },
    ],
  },
  {
    label: "Women",
    href: "/women",
    subLinks: [
      { label: "Shop All", href: "/women" },
      { label: "T-Shirts", href: "/women/t-shirts" },
      { label: "Hoodies & Sweatshirts", href: "/women/hoodies-sweatshirts" },
      { label: "Sweaters & Knitwear", href: "/women/sweaters-knitwear" },
      { label: "Accessories", href: "/women/accessories" },
    ],
  },
];

const topLinks = [
  { label: "Unisex", href: "/unisex" },
  { label: "Accessories", href: "/accessories" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Sale", href: "/sale" },
];

const utilityLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Track order", href: "/track-order" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PilotNav() {
  const { totalItems, setCartOpen } = useCart();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);

  return (
    <header className="fixed inset-x-0 top-0 z-[100] border-b border-border/60 bg-void/95 backdrop-blur-sm after:absolute after:bottom-[-1px] after:left-0 after:h-px after:w-1/3 after:bg-accent after:content-['']">
      <nav aria-label="Primary navigation" className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-base font-bold uppercase tracking-[-0.03em] text-cream hover:text-accent focus-visible:outline-offset-4">
          After Hours Agenda
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <div className="hidden items-center gap-1 lg:flex">
            {genderLinks.map((gender) => (
              <div key={gender.label} className="group relative">
                <Link
                  href={gender.href}
                  className={`nav-link inline-flex min-h-11 items-center px-3 font-mono text-xs font-bold uppercase tracking-[0.06em] transition-colors ${
                    isActive(pathname, gender.href) ? "text-cream" : "text-muted hover:text-cream"
                  }`}
                >
                  {gender.label}
                </Link>
                <div className="absolute left-0 top-full hidden min-w-[16rem] border-b border-x border-border/60 bg-void/98 px-4 py-3 shadow-lg group-hover:block">
                  <ul className="space-y-1">
                    {gender.subLinks.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className={`inline-flex min-h-10 w-full items-center font-mono text-xs font-bold uppercase tracking-[0.06em] transition-colors ${
                            isActive(pathname, link.href) ? "text-accent" : "text-muted hover:text-cream"
                          }`}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

            {topLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link inline-flex min-h-11 items-center px-3 font-mono text-xs font-bold uppercase tracking-[0.06em] transition-colors ${
                  isActive(pathname, link.href) ? "text-cream" : "text-muted hover:text-cream"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <span className="mx-2 h-4 w-px bg-border/60" aria-hidden="true" />

            {utilityLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link inline-flex min-h-11 items-center px-3 font-mono text-xs font-bold uppercase tracking-[0.06em] transition-colors ${
                  isActive(pathname, link.href) ? "text-cream" : "text-muted hover:text-cream"
                }`}
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
            className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted hover:text-cream lg:hidden"
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
        className={`absolute left-0 right-0 top-full max-h-[80dvh] overflow-y-auto border-b border-border/60 bg-void/98 px-4 py-5 shadow-lg lg:hidden ${mobileOpen ? "block" : "hidden"}`}
      >
        <ul className="space-y-1">
          {genderLinks.map((gender) => (
            <li key={gender.label}>
              <button
                type="button"
                onClick={() => setOpenMobileSection(openMobileSection === gender.label ? null : gender.label)}
                className="inline-flex min-h-11 w-full items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.06em] text-cream"
                aria-expanded={openMobileSection === gender.label}
              >
                {gender.label}
                <span aria-hidden="true">{openMobileSection === gender.label ? "−" : "+"}</span>
              </button>
              {openMobileSection === gender.label && (
                <ul className="ml-3 space-y-1 border-l border-border/40 pl-3">
                  {gender.subLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="inline-flex min-h-10 w-full items-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted hover:text-accent"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}

          {topLinks.map((link) => (
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

          <li className="border-t border-border/40 pt-2" aria-hidden="true" />

          {utilityLinks.map((link) => (
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
