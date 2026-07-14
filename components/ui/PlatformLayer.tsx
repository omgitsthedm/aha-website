"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
// Both are progressive-enhancement, event/state-gated, and render null until they
// decide to show — so defer them off the initial bundle (no SSR output anyway).
const InAppBrowserNudge = dynamic(() => import("./InAppBrowserNudge").then((m) => m.InAppBrowserNudge), { ssr: false });
const InstallPrompt = dynamic(() => import("./InstallPrompt").then((m) => m.InstallPrompt), { ssr: false });
// Side-effect import: starts buffering `beforeinstallprompt` at first paint,
// before InstallPrompt mounts, so no install opportunity is missed.
import "@/lib/platform/pwaInstall";

/**
 * Platform experience layer, all progressive enhancement:
 * - registers the minimal service worker (offline fallback + push handlers)
 * - injects Speculation Rules so Chromium prerenders likely next pages
 *   (never cart/checkout/api — money pages always render fresh)
 * - surfaces the in-app-browser escape nudge (Instagram/TikTok/etc.) and the
 *   per-platform install hint (iOS Add-to-Home-Screen / Android native prompt)
 */
export function PlatformLayer() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (
      HTMLScriptElement.supports?.("speculationrules") &&
      !document.querySelector('script[type="speculationrules"]')
    ) {
      const rules = document.createElement("script");
      rules.type = "speculationrules";
      rules.textContent = JSON.stringify({
        prerender: [{
          where: {
            and: [
              { href_matches: "/*" },
              { not: { href_matches: "/cart" } },
              { not: { href_matches: "/checkout*" } },
              { not: { href_matches: "/api/*" } },
              { not: { href_matches: "/ops*" } },
              { not: { href_matches: "/track-order*" } },
            ],
          },
          eagerness: "moderate",
        }],
      });
      document.head.appendChild(rules);
    }
  }, []);

  return (
    <>
      <InAppBrowserNudge />
      <InstallPrompt />
    </>
  );
}
