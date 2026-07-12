"use client";

import Image from "next/image";
import Link from "next/link";
import { COLLECTION_CODES } from "@/lib/utils/collection-codes";

const SUPPORT_LINKS = [
  { label: "Shipping", href: "/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Care", href: "/care" },
  { label: "Size Guide", href: "/size-guide" },
  { label: "Track Order", href: "/track-order" },
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
        <div className="grid gap-10 border-b border-border/40 pb-12 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center border border-border/60 bg-cream">
                <Image src="/brand/sheep-head.svg" alt="" width={28} height={28} aria-hidden="true" />
              </span>
              <p className="font-display text-2xl font-black uppercase leading-none tracking-[-0.04em]">After Hours Agenda</p>
            </div>
            <p className="max-w-xl font-mono text-sm leading-relaxed text-muted">
              Independent New York streetwear for life outside the expected schedule. Made to order, shipped free, and supported by real people.
            </p>
            <div className="mt-6 flex flex-wrap gap-5 font-mono text-xs font-bold uppercase">
              <a href="https://instagram.com/afterhoursagenda" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-accent">Instagram</a>
              <a href="https://tiktok.com/@afterhoursagenda" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-accent">TikTok</a>
              <a href="mailto:hello@afterhoursagenda.com" className="inline-flex min-h-11 items-center text-muted underline underline-offset-4 hover:text-accent">Email</a>
            </div>
          </div>

          <div>
            <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Help</h2>
            <ul className="space-y-3">
              {SUPPORT_LINKS.map((link) => <li key={link.href}><Link href={link.href} className="inline-flex min-h-11 items-center font-mono text-sm text-muted underline underline-offset-4 hover:text-cream">{link.label}</Link></li>)}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-[0.08em] text-accent">Collections</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              {Object.values(COLLECTION_CODES).map((collection) => <li key={collection.slug}><Link href={`/collections/${collection.slug}`} className="inline-flex min-h-11 items-center font-mono text-xs text-muted underline underline-offset-4 hover:text-cream">{collection.name}</Link></li>)}
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
