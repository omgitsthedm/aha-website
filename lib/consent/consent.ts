"use client";

import { useEffect, useState } from "react";

/**
 * Cookie-consent state, persisted in localStorage. Tracking (GA / Meta / TikTok)
 * is OPT-IN: nothing loads until consent === "granted" (the GDPR/ePrivacy-safe
 * default). "denied" is remembered so we never nag. SSR-safe.
 */
export type Consent = "granted" | "denied";

export const CONSENT_STORAGE_KEY = "aha-cookie-consent";
let volatileConsent: Consent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

export function isGlobalPrivacyControlEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl === true;
}

/**
 * Read the stored choice. Exported because `lib/analytics/events.ts` is called
 * from plain event handlers and cannot use the `useConsent` hook — without this
 * it has to re-declare the storage key, and a rename there would silently fail
 * closed (every event dropped, no error). One key, one owner.
 */
export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  if (isGlobalPrivacyControlEnabled()) return "denied";
  try {
    const v = localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : volatileConsent;
  } catch {
    return volatileConsent;
  }
}

export function setConsent(v: Consent): void {
  const effectiveConsent =
    v === "granted" && isGlobalPrivacyControlEnabled() ? "denied" : v;
  volatileConsent = effectiveConsent;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, effectiveConsent);
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
export function useConsent(): {
  consent: Consent | null;
  mounted: boolean;
  globalPrivacyControl: boolean;
} {
  const [consent, setC] = useState<Consent | null>(null);
  const [mounted, setMounted] = useState(false);
  const [globalPrivacyControl, setGlobalPrivacyControl] = useState(false);
  useEffect(() => {
    setMounted(true);
    setGlobalPrivacyControl(isGlobalPrivacyControlEnabled());
    setC(getConsent());
    return subscribeConsent(() => setC(getConsent()));
  }, []);
  return { consent, mounted, globalPrivacyControl };
}
