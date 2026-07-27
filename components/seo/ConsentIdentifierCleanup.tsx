"use client";

import { useEffect, useRef } from "react";
import { useConsent } from "@/lib/consent/consent";

/**
 * Withdrawing consent has to delete the identifiers already written, not just
 * stop sending new hits. `setConsent("denied")` only flips a localStorage flag,
 * so `_ga`, `_ga_*` and `_fbp` survived an opt-out taken from a control labelled
 * "Do Not Sell or Share My Info" — on a site whose privacy policy promises
 * withdrawal.
 *
 * Reads consent through the public `useConsent()` subscription; it never writes
 * consent state, so the banner stays the single owner of that decision.
 *
 * PLACEMENT: this belongs in `components/consent/`. It sits here only because of
 * the file split in the 2026-07-27 remediation wave — move it when that wave is
 * merged; nothing imports it except `app/layout.tsx`.
 */

/**
 * First-party analytics cookies this site is responsible for. `_ga` covers the
 * per-property `_ga_G-XXXX` companions. Meta's own `connect.facebook.net`
 * cookies are third-party and unreachable from here by design — only the
 * first-party `_fbp` / `_fbc` browser IDs can be expired.
 */
const TRACKING_COOKIE = /^(_ga|_gid|_gat|_fbp|_fbc)/;

/**
 * A cookie is only removed when the delete matches the domain it was set on, and
 * GA sets `_ga` on the registrable domain (`.afterhoursagenda.com`) while other
 * tags use the exact host. Try every plausible scope; a miss is a no-op.
 */
function domainScopes(hostname: string): Array<string | null> {
  const scopes: Array<string | null> = [null, hostname, `.${hostname}`];
  const labels = hostname.split(".");
  if (labels.length > 2) {
    const registrable = labels.slice(-2).join(".");
    scopes.push(registrable, `.${registrable}`);
  }
  return scopes;
}

function expireTrackingCookies(): void {
  const scopes = domainScopes(window.location.hostname);
  const names = document.cookie
    .split(";")
    .map((pair) => pair.split("=")[0]?.trim() ?? "")
    .filter((name) => name.length > 0 && TRACKING_COOKIE.test(name));

  for (const name of names) {
    for (const domain of scopes) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

export function ConsentIdentifierCleanup() {
  const { consent, mounted } = useConsent();
  const cleaned = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    if (consent !== "denied") {
      // Re-arm, so a later granted -> denied flip in the same session cleans again.
      cleaned.current = false;
      return;
    }
    if (cleaned.current) return;
    cleaned.current = true;

    expireTrackingCookies();

    // gtag.js is injected once and is not removed when GoogleAnalytics unmounts,
    // so the tag can keep emitting on client-side navigations until the next hard
    // load. Consent Mode closes that window without a reload.
    window.gtag?.("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }, [consent, mounted]);

  return null;
}
