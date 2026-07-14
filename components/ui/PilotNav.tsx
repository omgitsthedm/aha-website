"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { SearchOverlay, type SearchIndexItem } from "@/components/ui/SearchOverlay";

const genderLinks = [
  {
    label: "Men",
    href: "/men",
    image: "/campaign/hero-men.jpg",
    cta: { label: "Shop Men", href: "/men" },
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
    image: "/campaign/hero-women.jpg",
    cta: { label: "Shop Women", href: "/women" },
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
];

const utilityLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Track order", href: "/track-order" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PilotNav({ searchIndex = [] }: { searchIndex?: SearchIndexItem[] }) {
  const { totalItems, setCartOpen } = useCart();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-[100] border-b border-border/40 bg-void">
      <nav aria-label="Primary navigation" className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex h-14 items-center font-display text-sm font-bold uppercase tracking-[-0.02em] text-cream hover:text-accent focus-visible:outline-offset-4">
          After Hours Agenda
        </Link>

        <div className="flex items-center">
          <div className="hidden items-center lg:flex">
            {genderLinks.map((gender) => (
              <div key={gender.label} className="group relative">
                <Link
                  href={gender.href}
                  className={`inline-flex h-14 items-center px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                    isActive(pathname, gender.href) ? "text-cream" : "text-muted hover:text-cream"
                  }`}
                >
                  {gender.label}
                </Link>
                <div className="invisible absolute left-0 top-full min-w-[24rem] border border-border/40 bg-void opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="grid grid-cols-[1fr_10rem]">
                    <ul className="space-y-0.5 px-2 py-2">
                      {gender.subLinks.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={`inline-flex h-10 w-full items-center px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                              isActive(pathname, link.href) ? "text-accent" : "text-muted hover:bg-charcoal hover:text-cream"
                            }`}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href={gender.cta.href} className="group/image relative block overflow-hidden">
                      <Image
                        src={gender.image}
                        alt={gender.cta.label}
                        fill
                        className="object-cover transition-transform duration-500 group-hover/image:scale-105"
                        sizes="10rem"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void/90 to-transparent p-3 pt-10">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-cream underline underline-offset-4">{gender.cta.label}</span>
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {topLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex h-14 items-center px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                  isActive(pathname, link.href) ? "text-cream" : "text-muted hover:text-cream"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <span className="mx-2 h-4 w-px bg-border/10" aria-hidden="true" />

            {utilityLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex h-14 items-center px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                  isActive(pathname, link.href) ? "text-cream" : "text-muted hover:text-cream"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-14 items-center px-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:text-cream"
            aria-label="Search products"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="inline-flex h-14 items-center px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-cream transition-colors hover:text-accent"
            aria-label={`Open bag${totalItems ? `, ${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}`}
          >
            Bag{totalItems ? ` ${totalItems}` : ""}
          </button>

          <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} index={searchIndex} />

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-14 items-center justify-center px-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted transition-colors hover:text-cream lg:hidden"
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
        className={`absolute inset-x-0 top-14 border-b border-border/40 bg-void shadow-xl lg:hidden ${mobileOpen ? "block" : "hidden"}`}
      >
        <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6">
          <ul className="space-y-1">
            {genderLinks.map((gender) => (
              <li key={gender.label}>
                <button
                  type="button"
                  onClick={() => setOpenMobileSection(openMobileSection === gender.label ? null : gender.label)}
                  className="inline-flex h-12 w-full items-center justify-between font-mono text-xs font-bold uppercase tracking-[0.08em] text-cream"
                  aria-expanded={openMobileSection === gender.label}
                >
                  {gender.label}
                  <span aria-hidden="true">{openMobileSection === gender.label ? "−" : "+"}</span>
                </button>
                {openMobileSection === gender.label && (
                  <ul className="ml-3 space-y-0.5 border-l border-border/40 pl-3">
                    {gender.subLinks.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className="inline-flex h-10 w-full items-center font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted hover:text-accent"
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
                  className="inline-flex h-12 w-full items-center font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted hover:text-accent"
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
                  className="inline-flex h-12 w-full items-center font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}
