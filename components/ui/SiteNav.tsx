"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import { type SearchIndexItem } from "@/components/ui/SearchOverlay";
import { isStorefrontPublic } from "@/lib/commerce/catalog-policy";

// Portal overlay that only renders when opened — load it on demand.
const SearchOverlay = dynamic(() => import("@/components/ui/SearchOverlay").then((m) => m.SearchOverlay), { ssr: false });

// One capsule, one cut. Eight pieces do not need Men / Women / Unisex /
// Accessories / New Arrivals — five doors into the same room read as a
// template, and two of them opened on empty pages. Shop, then the two garment
// families, then the brand.
const shopLinks = [
  { label: "Shop", href: "/shop" },
  { label: "Tees", href: "/shop/t-shirts" },
  { label: "Hoods & Crews", href: "/shop/hoodies-sweatshirts" },
];

const utilityLinks = [
  { label: "Manifesto", href: "/manifesto" },
  { label: "About", href: "/about" },
  { label: "Track order", href: "/track-order" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const catalogIsPublic = isStorefrontPublic();
  const { totalItems, setCartOpen } = useCart();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Search index is fetched lazily the first time search opens, so it no longer
  // blocks (or bloats) every page render.
  const [searchIndex, setSearchIndex] = useState<SearchIndexItem[]>([]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!searchOpen || searchIndex.length > 0) return;
    let active = true;
    fetch("/api/search-index")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (active && Array.isArray(data)) setSearchIndex(data); })
      .catch(() => { /* search degrades to empty; shopping unaffected */ });
    return () => { active = false; };
  }, [searchOpen, searchIndex.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!catalogIsPublic) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (!typing) {
          event.preventDefault();
          setSearchOpen(true);
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [catalogIsPublic]);

  return (
    <header className="safe-top safe-x fixed inset-x-0 top-0 z-[100] border-b border-border/10 bg-void">
      <nav aria-label="Primary navigation" className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" prefetch={false} className="inline-flex h-14 items-center font-display text-sm font-bold uppercase tracking-[-0.02em] text-cream hover:text-accent focus-visible:outline-offset-4">
          After Hours Agenda
        </Link>

        <div className="flex items-center">
          <div className="hidden items-center lg:flex">
            {catalogIsPublic && <>
            {shopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link inline-flex h-14 items-center px-4 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                  (link.href === "/shop" ? pathname === "/shop" : isActive(pathname, link.href)) ? "text-cream" : "text-muted hover:text-cream"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <span className="mx-2 h-4 w-px bg-border/10" aria-hidden="true" />
            </>}

            {utilityLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link inline-flex h-14 items-center px-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                  isActive(pathname, link.href) ? "text-cream" : "text-muted hover:text-cream"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {catalogIsPublic && <>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-14 min-w-11 items-center justify-center px-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted transition-colors hover:text-cream sm:px-3"
            aria-label="Search products"
          >
            <span className="hidden sm:inline">Search</span>
            <svg aria-hidden="true" className="h-5 w-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
          </button>
          <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} index={searchIndex} />
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="inline-flex h-14 items-center px-4 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cream transition-colors hover:text-accent"
            aria-label={`Open bag${totalItems ? `, ${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}`}
          >
            Bag{totalItems ? ` ${totalItems}` : ""}
          </button>
          </>}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-14 items-center justify-center px-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted transition-colors hover:text-cream lg:hidden"
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
        className={`mobile-menu-panel absolute inset-x-0 max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] overflow-y-auto border-b border-border/10 bg-void shadow-xl lg:hidden ${mobileOpen ? "mobile-menu-enter block" : "hidden"}`}
      >
        <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6">
          <ul className="space-y-1">
            {catalogIsPublic && <>
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-12 w-full items-center font-mono text-xs font-bold uppercase tracking-[0.08em] text-cream hover:text-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            <li className="border-t border-border/10 pt-2" aria-hidden="true" />
            </>}

            {utilityLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-12 w-full items-center font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted hover:text-accent"
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
