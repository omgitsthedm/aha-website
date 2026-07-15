import Link from "next/link";
import { SheepMark } from "@/components/ui/SheepMark";
import { ConsentSettingsLink } from "@/components/consent/ConsentSettingsLink";

const serviceLinks = [
  { label: "Shipping", href: "/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Care", href: "/care" },
  { label: "Size guide", href: "/size-guide" },
  { label: "Track order", href: "/track-order" },
  { label: "Contact", href: "/contact" },
];

const legalLinks = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Accessibility", href: "/accessibility" },
];

const shopLinks = [
  { label: "Men", href: "/men" },
  { label: "Women", href: "/women" },
  { label: "Unisex", href: "/unisex" },
  { label: "Accessories", href: "/accessories" },
  { label: "New Arrivals", href: "/new-arrivals" },
];

const brandLinks = [
  { label: "About", href: "/about" },
  { label: "Lookbook", href: "/lookbook" },
  { label: "FAQ", href: "/faq" },
];

export function PilotFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-void px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)_minmax(18rem,0.5fr)]">
        <div className="fold-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-end gap-6"><SheepMark className="w-20 text-cream" title="After Hours Agenda black sheep" /><p className="font-display text-[clamp(2.5rem,6vw,5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">After Hours Agenda</p></div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">Expressive everyday clothing from New York. Tees, hoodies, sweatshirts, and accessories, printed to order. Questions? Email info@afterhoursagenda.com.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="mailto:info@afterhoursagenda.com" className="btn-secondary">Email support</a>
            <a href="https://www.instagram.com/afterhoursagenda" target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 border border-border/60 px-4 text-xs font-bold uppercase tracking-wide text-cream transition-colors hover:border-accent hover:text-accent">
              Instagram
            </a>
            <a href="https://www.tiktok.com/@afterhoursagenda" target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 border border-border/60 px-4 text-xs font-bold uppercase tracking-wide text-cream transition-colors hover:border-accent hover:text-accent">
              TikTok
            </a>
            <a href="https://www.facebook.com/afterhoursagenda" target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 border border-border/60 px-4 text-xs font-bold uppercase tracking-wide text-cream transition-colors hover:border-accent hover:text-accent">
              Facebook
            </a>
          </div>

          <div className="mt-8 border-t border-border/40 pt-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Newsletter</p>
            <p className="mt-2 max-w-sm text-sm text-muted">New releases and the occasional note from the shop. No spam, unsubscribe anytime.</p>
            <form name="newsletter" method="POST" data-netlify="true" className="mt-4 flex max-w-sm flex-col gap-3 sm:flex-row" action="/newsletter">
              <input type="hidden" name="form-name" value="newsletter" />
              <label htmlFor="footer-email" className="sr-only">Email address</label>
              <input
                id="footer-email"
                name="email"
                type="email"
                required
                placeholder="you@email.com"
                className="min-h-11 flex-1 border border-border/60 bg-void px-4 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button type="submit" className="btn-primary">Subscribe</button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 border-t border-accent pt-5 lg:grid-cols-1">
          <nav aria-label="Shop">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Shop</p>
            <ul className="mt-3 space-y-1">
              {shopLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-border underline-offset-4 hover:text-cream">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Customer service">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Service</p>
            <ul className="mt-3 space-y-1">
              {serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-border underline-offset-4 hover:text-cream">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="space-y-8 border-t border-accent pt-5">
          <nav aria-label="Brand">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Brand</p>
            <ul className="mt-3 space-y-1">
              {brandLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-border underline-offset-4 hover:text-cream">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Legal">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Legal</p>
            <ul className="mt-3 space-y-1">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-border underline-offset-4 hover:text-cream">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li><ConsentSettingsLink /></li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1280px] flex-col justify-between gap-4 border-t border-border/40 pt-5 sm:flex-row sm:items-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">© 2026 After Hours Agenda</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          Designed, Hosted and Cared For by{" "}
          <a href="https://littlefightnyc.com" className="text-accent underline underline-offset-4 hover:text-cream">
            LittleFightNYC.com
          </a>
        </p>
      </div>
    </footer>
  );
}
