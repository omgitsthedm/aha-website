"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { COLLECTION_CODES } from "@/lib/utils/collection-codes";

const PRIMARY_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "New arrivals", href: "/new-arrivals" },
  { label: "Releases", href: "/drops" },
  { label: "Design files", href: "/lookbook" },
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
      <nav aria-label="Main navigation" className="fixed inset-x-0 top-8 z-[100] border-b border-border/40 bg-void">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 md:px-6">
          <Link href="/" onClick={closeMenu} aria-label="After Hours Agenda home" className="inline-flex min-h-11 items-center text-cream">
            <span className="font-display text-sm font-bold uppercase leading-none tracking-[-0.025em] sm:text-base">After Hours Agenda</span>
          </Link>

          <div className="hidden items-center gap-5 lg:flex">
            {PRIMARY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="nav-link inline-flex min-h-11 items-center font-mono text-xs font-bold uppercase tracking-[0.06em] text-muted transition-colors hover:text-cream">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setCartOpen(true)} className="relative min-h-11 bg-accent px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.06em] text-void transition-colors hover:bg-cream" aria-label={`Open bag${totalItems ? `, ${totalItems} item${totalItems === 1 ? "" : "s"}` : ""}`}>
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
        aria-hidden={!menuOpen}
        data-open={menuOpen}
        className="mobile-menu fixed inset-0 z-[90] overflow-y-auto bg-void px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-28 lg:hidden"
      >
          <div className="mx-auto max-w-xl">
            <Link href="/" prefetch={false} onClick={closeMenu} className="mb-8 block border-b border-accent pb-5 font-display text-2xl font-bold uppercase leading-none tracking-[-0.035em] text-cream">
              After Hours Agenda
            </Link>
            <p className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Browse</p>
            <div className="grid border-t border-border/40">
              {PRIMARY_LINKS.map((link) => (
                <Link key={link.href} href={link.href} prefetch={false} onClick={closeMenu} className="flex min-h-14 items-center border-b border-border/40 font-display text-2xl font-black uppercase text-cream transition-colors hover:text-accent">
                  {link.label}
                </Link>
              ))}
            </div>

            <p className="mb-3 mt-8 font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted">Collections</p>
            <div className="grid border-t border-border/40">
              {COLLECTIONS.map((collection) => (
                <Link key={collection.slug} href={`/collections/${collection.slug}`} prefetch={false} onClick={closeMenu} className="flex min-h-12 items-center border-b border-border/40 py-3 font-mono text-xs font-bold uppercase text-cream transition-[color,transform] duration-200 hover:translate-x-1 hover:text-accent">
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
