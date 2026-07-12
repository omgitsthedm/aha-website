"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { COLLECTION_CODES } from "@/lib/utils/collection-codes";

const PRIMARY_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "New", href: "/new-arrivals" },
  { label: "Catalog Edit", href: "/best-sellers" },
  { label: "Drops", href: "/drops" },
  { label: "Lookbook", href: "/lookbook" },
  { label: "About", href: "/about" },
];

const COLLECTIONS = Object.values(COLLECTION_CODES).map((collection) => ({ slug: collection.slug, name: collection.name }));

export function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems, setCartOpen } = useCart();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusable?.[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      menuButton?.focus();
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav aria-label="Main navigation" className="fixed inset-x-0 top-8 z-[100] border-b border-border/40 bg-void/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 md:px-6">
          <Link href="/" onClick={closeMenu} aria-label="After Hours Agenda home" className="inline-flex min-h-11 min-w-11 items-center gap-3 text-cream">
            <span className="flex h-10 w-10 items-center justify-center border border-border/60 bg-cream">
              <Image src="/brand/sheep-head.svg" alt="" width={26} height={26} aria-hidden="true" />
            </span>
            <span className="hidden font-display text-sm font-black uppercase leading-none tracking-[-0.03em] sm:block">After Hours Agenda</span>
          </Link>

          <div className="hidden items-center gap-5 lg:flex">
            {PRIMARY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted transition-colors hover:text-cream">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setCartOpen(true)} className="relative min-h-11 border border-accent px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.06em] text-accent transition-colors hover:bg-accent hover:text-void" aria-label={`Open bag${totalItems ? `, ${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}`}>
              Bag{totalItems > 0 ? ` (${totalItems})` : ""}
            </button>
            <button ref={menuButtonRef} onClick={() => setMenuOpen((open) => !open)} className="flex h-11 min-w-11 items-center justify-center border border-border/60 px-3 font-mono text-xs font-bold uppercase text-cream lg:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobile-nav-menu">
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </nav>

      <div
        id="mobile-nav-menu"
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        hidden={!menuOpen}
        className="fixed inset-0 z-[90] overflow-y-auto bg-void px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-28 lg:hidden"
      >
          <div className="mx-auto max-w-xl">
            <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Browse</p>
            <div className="grid border-t border-border/40">
              {PRIMARY_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={closeMenu} className="flex min-h-14 items-center border-b border-border/40 font-display text-2xl font-black uppercase text-cream transition-colors hover:text-accent">
                  {link.label}
                </Link>
              ))}
            </div>

            <p className="mb-3 mt-8 font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted">Collections</p>
            <div className="grid grid-cols-2 gap-px border border-border/40 bg-border/40">
              {COLLECTIONS.map((collection) => (
                <Link key={collection.slug} href={`/collections/${collection.slug}`} onClick={closeMenu} className="min-h-12 bg-void p-3 font-mono text-xs font-bold uppercase text-cream transition-colors hover:text-accent">
                  {collection.name}
                </Link>
              ))}
            </div>
          </div>
      </div>
    </>
  );
}

export default NavBar;
