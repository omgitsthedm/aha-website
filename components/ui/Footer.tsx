"use client";

import Image from "next/image";
import Link from "next/link";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";

const SUPPORT_LINKS = [
  { label: "Shipping", href: "/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Care", href: "/care" },
  { label: "Size Guide", href: "/size-guide" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative z-[2] border-t-[5px] border-[#E9E1D4] bg-[#10100F] px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 grid gap-6 lg:grid-cols-[1.35fr_0.8fr_0.8fr]">
          <div className="zine-block-hot zine-cut p-6 md:p-8">
            <div className="mb-6 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center border-[3px] border-[#10100F] bg-[#CCFF00]">
                <Image
                  src="/brand/sheep-head.svg"
                  alt=""
                  width={34}
                  height={34}
                  aria-hidden="true"
                />
              </span>
              <p className="font-display text-[clamp(2.8rem,6vw,5.5rem)] font-black uppercase leading-[0.8] tracking-[-0.08em] text-[#10100F]">
                Everything is after hours
              </p>
            </div>
            <p className="max-w-2xl font-body text-base font-bold leading-relaxed text-[#10100F]">
              Graphic tees, noisy color, anti-corporate attitude, and pieces
              made only after somebody actually wants one.
            </p>
          </div>

          <div className="zine-block p-6">
            <h2 className="mb-5 font-display text-3xl font-black uppercase leading-none tracking-[-0.05em]">
              Help
            </h2>
            <ul className="grid gap-3">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-body text-sm font-bold uppercase text-muted underline decoration-[#CCFF00] decoration-2 underline-offset-4 transition-colors hover:text-[#CCFF00]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="zine-block p-6">
            <h2 className="mb-5 font-display text-3xl font-black uppercase leading-none tracking-[-0.05em]">
              Contact
            </h2>
            <ul className="grid gap-3">
              <li>
                <a
                  href="mailto:hello@afterhoursagenda.com"
                  className="break-all font-body text-sm font-bold text-muted underline decoration-[#00FFFF] decoration-2 underline-offset-4 transition-colors hover:text-[#00FFFF]"
                >
                  hello@afterhoursagenda.com
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/afterhoursagenda"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm font-bold uppercase text-muted underline decoration-[#FF006E] decoration-2 underline-offset-4 transition-colors hover:text-[#FF006E]"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://tiktok.com/@afterhoursagenda"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm font-bold uppercase text-muted underline decoration-[#BF00FF] decoration-2 underline-offset-4 transition-colors hover:text-[#BF00FF]"
                >
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mb-10 flex flex-wrap gap-3">
          {Object.values(SUBWAY_LINES).map((line) => (
            <Link
              key={line.slug}
              href={`/collections/${line.slug}`}
              className="transition-transform duration-200 hover:-translate-y-0.5"
            >
              <RouteBadge slug={line.slug} size="md" showName />
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-5 border-t-[3px] border-[#E9E1D4] pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-body text-xs font-bold uppercase text-muted underline underline-offset-4 transition-colors hover:text-cream"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="font-body text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Copyright {new Date().getFullYear()} After Hours Agenda
          </p>

          <button
            onClick={scrollToTop}
            className="min-h-11 border-[3px] border-[#E9E1D4] bg-[#15110F] px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.08em] text-[#E9E1D4] transition-colors hover:bg-[#CCFF00] hover:text-[#10100F]"
          >
            Back to Top
          </button>
        </div>
      </div>
    </footer>
  );
}
