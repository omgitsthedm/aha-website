"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useConsent,
  setConsent,
  OPEN_CONSENT_EVENT,
} from "@/lib/consent/consent";
import { CONSENT_RESOLVED_ATTRIBUTE } from "@/lib/consent/bootstrap";

/**
 * Cookie-consent banner. Shows until the shopper chooses; tracking stays OFF
 * until "Accept". A "Cookie settings" link elsewhere can reopen it to change the
 * choice. Fixed to the bottom, dismissible, honesty-doctrine calm (no dark
 * patterns — Reject is as prominent as Accept).
 */
export function CookieConsent() {
  const { consent, globalPrivacyControl } = useConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => {
      document.documentElement.removeAttribute(CONSENT_RESOLVED_ATTRIBUTE);
      setReopened(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  const visible = consent === null || reopened;

  const choose = (v: "granted" | "denied") => {
    document.documentElement.setAttribute(CONSENT_RESOLVED_ATTRIBUTE, "");
    setConsent(v);
    setReopened(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      data-aha-consent-banner=""
      data-reopened={reopened ? "true" : undefined}
      className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[400] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm"
    >
      {/* Calm on purpose. This is a legal notice, not the brand's opening line:
          ink on paper, one line, two equal buttons, tucked into a corner on
          desktop so the photograph stays the loudest thing on the page. */}
      <div className="border-t border-border/60 bg-void px-4 py-3 shadow-[0_-8px_24px_rgb(0_0_0/0.06)] sm:border sm:shadow-[0_12px_32px_rgb(0_0_0/0.10)]">
        <p className="text-xs leading-snug text-muted">
          {globalPrivacyControl
            ? "Your browser sent a Global Privacy Control signal. Optional analytics stay off while it is active."
            : "Optional analytics stay off until you accept."}{" "}
          <Link href="/privacy" prefetch={false} className="font-bold text-cream underline underline-offset-2 hover:text-accent">Details</Link>
        </p>
        <div className={`mt-2.5 grid gap-2 ${globalPrivacyControl ? "grid-cols-1" : "grid-cols-2"}`}>
          <button
            type="button"
            onClick={() => choose("denied")}
            className="min-h-11 whitespace-nowrap border border-border/60 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-cream"
          >
            {globalPrivacyControl ? "Keep tracking off" : "Reject"}
          </button>
          {!globalPrivacyControl && (
            <button type="button" onClick={() => choose("granted")} className="min-h-11 whitespace-nowrap border border-cream bg-cream px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-void transition-colors hover:bg-charcoal hover:border-charcoal">
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
