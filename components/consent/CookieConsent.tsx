"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsent, setConsent, OPEN_CONSENT_EVENT } from "@/lib/consent/consent";

/**
 * Cookie-consent banner. Shows until the shopper chooses; tracking stays OFF
 * until "Accept". A "Cookie settings" link elsewhere can reopen it to change the
 * choice. Fixed to the bottom, dismissible, honesty-doctrine calm (no dark
 * patterns — Reject is as prominent as Accept).
 */
export function CookieConsent() {
  const { consent, mounted } = useConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  if (!mounted) return null;
  if (consent !== null && !reopened) return null;

  const choose = (v: "granted" | "denied") => {
    setConsent(v);
    setReopened(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-[400] border-t border-border/60 bg-void"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-cream sm:text-sm">
          Analytics cookies are optional and stay off until you accept.{" "}
          <Link href="/privacy" className="font-bold text-accent underline underline-offset-2 hover:text-cream">Details</Link>
        </p>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="min-h-11 whitespace-nowrap border border-border/60 px-4 text-xs font-bold uppercase tracking-wide text-cream transition-colors hover:border-accent hover:text-accent"
          >
            Reject
          </button>
          <button type="button" onClick={() => choose("granted")} className="btn-primary whitespace-nowrap">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
