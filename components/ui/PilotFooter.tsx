import Link from "next/link";

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

export function PilotFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-void px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
        <div className="fold-surface p-6 sm:p-8">
          <p className="font-display text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.9] tracking-[-0.05em]">After Hours Agenda</p>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">Three hoodies are live while the new collection is built. Questions about an order or the storefront can go directly to info@afterhoursagenda.com.</p>
          <a href="mailto:info@afterhoursagenda.com" className="secondary-action mt-6 px-5 py-3 text-xs">Email support</a>
        </div>

        <div className="grid grid-cols-2 gap-8 border-t border-accent pt-5 lg:grid-cols-1">
          <nav aria-label="Customer service">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Service</p>
            <ul className="mt-3 space-y-1">
              {serviceLinks.map((link) => <li key={link.href}><Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-border underline-offset-4 hover:text-cream">{link.label}</Link></li>)}
            </ul>
          </nav>
          <nav aria-label="Legal">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent">Legal</p>
            <ul className="mt-3 space-y-1">
              {legalLinks.map((link) => <li key={link.href}><Link href={link.href} className="inline-flex min-h-11 items-center text-sm text-muted underline decoration-border underline-offset-4 hover:text-cream">{link.label}</Link></li>)}
            </ul>
          </nav>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-[1280px] border-t border-border/40 pt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">© 2026 After Hours Agenda</p>
    </footer>
  );
}
