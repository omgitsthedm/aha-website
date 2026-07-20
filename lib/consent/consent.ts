"use client";

import { useEffect, useState } from "react";

/**
 * Cookie-consent state, persisted in localStorage. Tracking (GA / Meta / TikTok)
 * is OPT-IN: nothing loads until consent === "granted" (the GDPR/ePrivacy-safe
 * default). "denied" is remembered so we never nag. SSR-safe.
 */
export type Consent = "granted" | "denied";

const KEY = "aha-cookie-consent";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(v: Consent): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* private mode — holds for this session */
  }
  notify();
}

function subscribeConsent(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reopen the banner so a shopper can change their choice ("Cookie settings"). */
export const OPEN_CONSENT_EVENT = "aha:open-consent";
export function openConsentSettings(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

/** Hydration-safe read: null on server + first render, real value after mount. */
export function useConsent(): { consent: Consent | null; mounted: boolean } {
  const [consent, setC] = useState<Consent | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setC(getConsent());
    return subscribeConsent(() => setC(getConsent()));
  }, []);
  return { consent, mounted };
}
