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
      className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[400] border-t border-border/60 bg-void"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
        <p className="min-w-0 flex-1 text-xs leading-snug text-cream sm:text-sm">
          {globalPrivacyControl
            ? "Your browser sent a Global Privacy Control signal. Optional analytics and advertising stay off while it is active."
            : "Optional analytics stay off until you accept."}{" "}
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
