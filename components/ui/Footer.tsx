import Link from "next/link";

const footerLinks = {
  shop: [
    { href: "/shop", label: "All Products" },
    { href: "/collections/black-sheep", label: "Black Sheep" },
    { href: "/collections/no-kings", label: "No Kings" },
    { href: "/collections/night-mode", label: "Night Mode" },
    { href: "/collections/nyc-forever", label: "NYC Forever" },
  ],
  info: [
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
    { href: "/size-guide", label: "Size Guide" },
    { href: "/care", label: "Care Instructions" },
  ],
  legal: [
    { href: "/shipping", label: "Shipping" },
    { href: "/returns", label: "Returns" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-void">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <h3 className="font-display font-bold text-lg mb-4">
              AFTER HOURS AGENDA
            </h3>
            <p className="text-muted text-sm leading-relaxed">
              NYC-born streetwear for those who write their own rules.
              Every piece tells a story.
            </p>
          </div>

          {/* Shop links */}
          <div>
            <h4 className="font-mono text-label uppercase tracking-widest text-muted mb-4">
              Collections
            </h4>
            <ul className="space-y-2">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-cream/60 hover:text-glow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info links */}
          <div>
            <h4 className="font-mono text-label uppercase tracking-widest text-muted mb-4">
              Info
            </h4>
            <ul className="space-y-2">
              {footerLinks.info.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-cream/60 hover:text-glow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="font-mono text-label uppercase tracking-widest text-muted mb-4">
              Legal
            </h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-cream/60 hover:text-glow transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[11px] text-muted">
            &copy; {new Date().getFullYear()} AFTER HOURS AGENDA. ALL RIGHTS RESERVED.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="https://instagram.com/afterhoursagenda"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-glow transition-colors"
              aria-label="Instagram"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
              </svg>
            </a>
            <a
              href="https://tiktok.com/@afterhoursagenda"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-glow transition-colors"
              aria-label="TikTok"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.16V11.7a4.84 4.84 0 01-3.02-1.04V6.69h3.02z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
