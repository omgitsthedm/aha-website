"use client";

import Link from "next/link";
import { RouteBadge } from "@/components/ui/RouteBadge";
import { WhiteBand } from "@/components/ui/WhiteBand";
import { SUBWAY_LINES } from "@/lib/utils/subway-lines";

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative z-[2] subway-tiles">
      <WhiteBand strong />

      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          {/* Col 1 — Brand */}
          <div>
            <div className="mb-6">
              <div className="mosaic-border-thin" />
              <div className="sign-panel-station py-2.5 px-4">
                <span className="sign-panel-station-text text-[11px]">After Hours Agenda</span>
              </div>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Premium streetwear from New York City. Every piece made
              to order, every collection with a story to tell.
            </p>
          </div>

          {/* Col 2 — Contact */}
          <div>
            <div className="mb-6">
              <div className="mosaic-border-thin" />
              <div className="sign-panel-station py-2.5 px-4">
                <span className="sign-panel-station-text text-[11px]">Contact</span>
              </div>
            </div>
            <ul className="space-y-4">
              <li>
                <a
                  href="mailto:hello@afterhoursagenda.com"
                  className="font-body font-medium text-sm text-muted hover:text-cream transition-colors"
                >
                  hello@afterhoursagenda.com
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/afterhoursagenda"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body font-medium text-sm text-muted hover:text-cream transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://tiktok.com/@afterhoursagenda"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body font-medium text-sm text-muted hover:text-cream transition-colors"
                >
                  TikTok
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3 — Collections */}
          <div>
            <div className="mb-6">
              <div className="mosaic-border-thin" />
              <div className="sign-panel-station py-2.5 px-4">
                <span className="sign-panel-station-text text-[11px]">Collections</span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {Object.values(SUBWAY_LINES).map((line) => (
                <Link
                  key={line.slug}
                  href={`/collections/${line.slug}`}
                  className="hover:opacity-80 transition-opacity inline-block hover:translate-x-0.5 transition-transform duration-200"
                >
                  <RouteBadge slug={line.slug} size="md" showName />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Sheep SVG */}
        <div className="flex justify-center mt-16">
          <svg
            className="w-20 h-20 opacity-10 text-cream hover-flicker"
            viewBox="0 0 200 160"
            fill="currentColor"
          >
            <path d="M60 55 C40 50, 25 60, 25 78 C25 96, 35 108, 55 110 L55 140 L65 140 L65 112 L90 114 L90 140 L100 140 L100 114 L125 112 L125 140 L135 140 L135 110 L150 108 L150 140 L160 140 L160 105 C175 98, 180 85, 178 72 C176 58, 165 48, 150 48 C145 42, 135 40, 125 42 C115 36, 100 35, 88 38 C78 34, 65 38, 60 48 Z" />
            <path d="M25 78 C18 75, 10 68, 8 60 C6 52, 10 44, 18 40 C26 36, 35 38, 40 44 C42 48, 40 55, 35 60 C30 65, 25 72, 25 78 Z" />
            <ellipse cx="20" cy="54" rx="4" ry="5" fill="#E8E4D8" />
            <path d="M18 40 C14 32, 8 28, 4 30 C0 32, 2 38, 8 42 Z" />
          </svg>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-10">
          <WhiteBand strong />
          <div className="flex items-center justify-between mt-10">
            {/* Left — Copyright */}
            <p className="font-body font-medium text-xs text-muted tracking-[0.15em]">
              &copy; {new Date().getFullYear()} AFTER HOURS AGENDA. ALL RIGHTS RESERVED.
            </p>

            {/* Center — Back to top */}
            <button
              onClick={scrollToTop}
              className="font-body text-sm text-muted hover:text-cream transition-all duration-200 w-9 h-9 flex items-center justify-center rounded-full hover:ring-1 hover:ring-cream/20"
              aria-label="Back to top"
            >
              &uarr;
            </button>

            {/* Right — Social icons */}
            <div className="flex items-center gap-6">
              <a
                href="https://instagram.com/afterhoursagenda"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-cream transition-colors"
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
                className="text-muted hover:text-cream transition-colors"
                aria-label="TikTok"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.16V11.7a4.84 4.84 0 01-3.02-1.04V6.69h3.02z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
