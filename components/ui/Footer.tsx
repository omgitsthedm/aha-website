"use client";

import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/content/site-copy";

const SUPPORT_LINKS = [
  { label: "Shipping", href: "/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Care", href: "/care" },
  { label: "Size Guide", href: "/size-guide" },
  { label: "FAQ", href: "/faq" },
  { label: "Track Order", href: "/track-order" },
  { label: "Restock alert", href: "/restock" },
  { label: "Contact", href: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Accessibility", href: "/accessibility" },
];

export function Footer() {
  return (
    <footer className="relative z-[2] border-t border-border/40 bg-void px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 border-b border-border/40 pb-12 lg:grid-cols-[1.6fr_0.8fr_0.8fr]">
          <div>
            <p className="mb-5 max-w-2xl font-display text-[clamp(3rem,6vw,6.5rem)] font-bold uppercase leading-[0.78] tracking-[-0.055em]">After Hours Agenda</p>
            <p className="max-w-lg font-mono text-sm leading-relaxed text-muted">
              Graphic clothing and objects made when you order. Standard shipping is included.
            </p>
            <div className="mt-6 flex flex-wrap gap-5 font-mono text-xs font-bold uppercase">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-accent">Email</a>
            </div>
          </div>

          <div>
            <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Help</h2>
            <ul className="space-y-3">
              {SUPPORT_LINKS.map((link) => <li key={link.href}><Link href={link.href} className="inline-flex min-h-11 items-center font-mono text-sm text-muted underline underline-offset-4 hover:text-cream">{link.label}</Link></li>)}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Browse</h2>
            <ul className="space-y-3">
              <li><Link href="/shop" className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">Shop</Link></li>
              <li><Link href="/new-arrivals" className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">New arrivals</Link></li>
              <li><Link href="/drops" className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">Releases</Link></li>
              <li><Link href="/lookbook" className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">Design files</Link></li>
              <li><Link href="/newsletter" className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">After Hours Dispatch</Link></li>
              <li><Link href="/about" className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">About</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-5 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            {LEGAL_LINKS.map((link) => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">{link.label}</Link>)}
          </div>
          <p className="font-mono text-xs text-muted">Copyright 2026 After Hours Agenda</p>
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="min-h-11 border border-border/60 px-4 py-2 font-mono text-xs font-bold uppercase text-cream transition-colors hover:border-accent hover:text-accent">Back to top</button>
        </div>
      </div>
    </footer>
  );
}
