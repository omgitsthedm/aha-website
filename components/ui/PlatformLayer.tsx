"use client";

import { useEffect } from "react";

/**
 * Platform experience layer, all progressive enhancement:
 * - registers the minimal service worker (offline fallback + push handlers)
 * - injects Speculation Rules so Chromium prerenders likely next pages
 *   (never cart/checkout/api — money pages always render fresh)
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

  return null;
}
