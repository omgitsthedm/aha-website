"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConsent, setConsent, OPEN_CONSENT_EVENT } from "@/lib/consent/consent";

/**
 * Published on <html> while the banner is on screen so other bottom-fixed
 * elements can sit above it instead of underneath. Consumers read it as
 * `bottom-[var(--aha-consent-h,0px)]`.
 */
const CONSENT_HEIGHT_VAR = "--aha-consent-h";

/**
 * Cookie-consent banner. Shows until the shopper chooses; tracking stays OFF
 * until "Accept". A "Cookie settings" link elsewhere can reopen it to change the
 * choice. Fixed to the bottom, dismissible, honesty-doctrine calm (no dark
 * patterns — Reject is as prominent as Accept).
 */
export function CookieConsent() {
  const { consent, mounted, globalPrivacyControl } = useConsent();
  const [reopened, setReopened] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  const visible = mounted && (consent === null || reopened);

  // Publish the live banner height so bottom-fixed elements (the PDP sticky buy
  // bar in particular) can offset above it. Measured rather than hardcoded
  // because the copy wraps to two lines on narrow viewports.
  useEffect(() => {
    const root = document.documentElement;
    const el = bannerRef.current;
    if (!visible || !el) {
      root.style.removeProperty(CONSENT_HEIGHT_VAR);
      return;
    }
    const publish = () => root.style.setProperty(CONSENT_HEIGHT_VAR, `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(CONSENT_HEIGHT_VAR);
    };
  }, [visible]);

  if (!visible) return null;

  const choose = (v: "granted" | "denied") => {
    setConsent(v);
    setReopened(false);
  };

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[400] border-t border-border/60 bg-void"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-cream sm:text-sm">
          {globalPrivacyControl
            ? "Your browser sent a Global Privacy Control signal. Optional analytics and advertising stay off while it is active."
            : "Analytics cookies are optional and stay off until you accept."}{" "}
          <Link href="/privacy" prefetch={false} className="font-bold text-accent underline underline-offset-2 hover:text-cream">Details</Link>
        </p>
        <div className={`grid shrink-0 gap-2 sm:flex ${globalPrivacyControl ? "grid-cols-1" : "grid-cols-2"}`}>
          <button
            type="button"
            onClick={() => choose("denied")}
            className="min-h-11 whitespace-nowrap border border-border/60 px-4 text-xs font-bold uppercase tracking-wide text-cream transition-colors hover:border-accent hover:text-accent"
          >
            {globalPrivacyControl ? "Keep tracking off" : "Reject"}
          </button>
          {!globalPrivacyControl && (
            <button type="button" onClick={() => choose("granted")} className="btn-primary whitespace-nowrap">
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
